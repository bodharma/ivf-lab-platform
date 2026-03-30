import { useState, useCallback, useEffect, useRef } from 'react'
import { useJoyride } from 'react-joyride'
import { EVENTS, STATUS, ACTIONS } from 'react-joyride'
import type { EventData } from 'react-joyride'
import type { Controls } from 'react-joyride'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getStepsForRole } from './tourSteps'
import TourTooltip from './TourTooltip'

const DISMISSED_KEY = 'ivf_guide_dismissed'

/**
 * For steps with route=null, resolve dynamic routes based on the step's target.
 * Uses the step target attribute (not index) so it works regardless of role filtering.
 */
/**
 * Cache of routes resolved during the tour, so we can navigate back
 * to previously visited pages (e.g. embryo detail from checklist).
 */
const visitedRoutes: Record<string, string> = {}

function resolveDynamicRoute(stepTarget: string): string | null {
  const key = stepTarget.includes('embryo-table') ? 'cycle'
    : (stepTarget.includes('grade-history') || stepTarget.includes('action-buttons') || stepTarget.includes('event-timeline')) ? 'embryo'
    : stepTarget.includes('checklist-runner') ? 'checklist'
    : stepTarget.includes('add-embryos') ? 'cycle'
    : null

  // Try to find a link on the current page
  if (stepTarget.includes('embryo-table') || stepTarget.includes('add-embryos')) {
    const link = document.querySelector('a[href^="/cycles/"]')
    const href = link?.getAttribute('href') ?? null
    if (href) { visitedRoutes['cycle'] = href; return href }
  }
  if (
    stepTarget.includes('grade-history') ||
    stepTarget.includes('action-buttons') ||
    stepTarget.includes('event-timeline')
  ) {
    const link = document.querySelector('a[href^="/embryos/"]')
    const href = link?.getAttribute('href') ?? null
    if (href) { visitedRoutes['embryo'] = href; return href }
  }
  if (stepTarget.includes('checklist-runner')) {
    const link = document.querySelector('a[href^="/checklists/"]')
    const href = link?.getAttribute('href') ?? null
    if (href) { visitedRoutes['checklist'] = href; return href }
  }

  // Fall back to a previously visited route for this type
  if (key && visitedRoutes[key]) {
    return visitedRoutes[key]
  }

  return null
}

/** Helper to click a settings tab using data-tour-tab attribute */
function clickSettingsTab(tabId: string) {
  const btn = document.querySelector(`[data-tour-tab="${tabId}"]`) as HTMLButtonElement | null
  btn?.click()
}

export default function DemoGuide() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [run, setRun] = useState(false)
  const waitingForNav = useRef(false)
  const controlsRef = useRef<Controls | null>(null)

  const role = user?.role ?? 'embryologist'
  const steps = getStepsForRole(role)

  const handleEvent = useCallback(
    (data: EventData, controls: Controls) => {
      controlsRef.current = controls
      const { action, index, status, type } = data

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(DISMISSED_KEY, 'true')
        navigate('/')
        return
      }

      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1

        if (nextIndex < 0 || nextIndex >= steps.length) return

        const nextStep = steps[nextIndex]

        if (nextStep.route === null) {
          const target = typeof nextStep.target === 'string' ? nextStep.target : ''
          const dynamicRoute = resolveDynamicRoute(target)
          if (dynamicRoute && location.pathname !== dynamicRoute) {
            controls.stop()
            waitingForNav.current = true
            setStepIndex(nextIndex)
            navigate(dynamicRoute)
            return
          }
          setStepIndex(nextIndex)
          controls.go(nextIndex)
          return
        }

        const needsNav = nextStep.route && location.pathname !== nextStep.route

        if (needsNav) {
          controls.stop()
          waitingForNav.current = true
          setStepIndex(nextIndex)
          navigate(nextStep.route)

          if (nextStep.route === '/settings') {
            setTimeout(() => {
              const target = typeof nextStep.target === 'string' ? nextStep.target : ''
              if (target.includes('users')) {
                clickSettingsTab('users')
              } else if (target.includes('storage')) {
                clickSettingsTab('storage')
              } else if (target.includes('templates')) {
                clickSettingsTab('templates')
              }
            }, 400)
          }
          return
        }

        // Same page — might need to switch settings tab
        if (location.pathname === '/settings') {
          const target = typeof nextStep.target === 'string' ? nextStep.target : ''
          if (target.includes('users')) clickSettingsTab('users')
          else if (target.includes('storage')) clickSettingsTab('storage')
          else if (target.includes('templates')) clickSettingsTab('templates')

          controls.stop()
          waitingForNav.current = true
          setStepIndex(nextIndex)
          setTimeout(() => {
            waitingForNav.current = false
            controlsRef.current?.start(nextIndex)
          }, 300)
          return
        }

        setStepIndex(nextIndex)
        controls.go(nextIndex)
      }
    },
    [steps, navigate, location.pathname]
  )

  const { Tour, controls } = useJoyride({
    steps,
    stepIndex,
    run,
    continuous: true,
    tooltipComponent: TourTooltip,
    onEvent: handleEvent,
    options: {
      skipBeacon: true,
      overlayClickAction: false,
      dismissKeyAction: false,
      buttons: ['back', 'skip', 'primary'],
      zIndex: 10000,
      overlayColor: '#00000080',
    },
  })

  // Sync controls ref when they become available
  useEffect(() => {
    if (controls) {
      controlsRef.current = controls
    }
  }, [controls])

  // Auto-start on mount if not dismissed
  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) {
      const timer = setTimeout(() => {
        setRun(true)
        controls?.start(0)
      }, 500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for restart event from replay button
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(DISMISSED_KEY)
      setStepIndex(0)
      setRun(true)
      controls?.start(0)
    }
    window.addEventListener('ivf-guide-restart', handler)
    return () => window.removeEventListener('ivf-guide-restart', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigation, wait for target element to appear then resume
  useEffect(() => {
    if (!waitingForNav.current) return

    const step = steps[stepIndex]
    if (!step) return

    const target = typeof step.target === 'string' ? step.target : null
    if (!target) return

    let attempts = 0
    const maxAttempts = 100
    let rafId: number

    const checkTarget = () => {
      const el = document.querySelector(target)
      if (el) {
        waitingForNav.current = false
        setTimeout(() => {
          setRun(true)
          controlsRef.current?.start(stepIndex)
        }, 300)
      } else if (attempts++ < maxAttempts) {
        rafId = requestAnimationFrame(checkTarget)
      } else {
        waitingForNav.current = false
        setStepIndex((prev) => {
          const next = prev + 1
          setTimeout(() => {
            setRun(true)
            controlsRef.current?.start(next)
          }, 300)
          return next
        })
      }
    }
    rafId = requestAnimationFrame(checkTarget)
    return () => cancelAnimationFrame(rafId)
  }, [location.pathname, stepIndex, steps])

  if (!user || steps.length === 0) return null

  return <>{Tour}</>
}
