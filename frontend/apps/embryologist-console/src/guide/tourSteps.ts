import type { Step } from 'react-joyride'

type TourStep = Step & {
  roles: string[]
  route: string | null
}

const ALL: string[] = []
const SENIOR_PLUS = ['senior_embryologist', 'lab_manager', 'clinic_admin']
const MANAGER_PLUS = ['lab_manager', 'clinic_admin']
const ADMIN_ONLY = ['clinic_admin']

export const tourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: 'Navigate Your Lab',
    content: 'Use the sidebar to switch between your daily view, weekly overview, data export, and settings.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="dashboard-header"]',
    title: 'Your Daily Overview',
    content: 'This is your home page. It shows all active cycles for today, sorted by urgency.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="day-badge"]',
    title: 'Urgency Indicators',
    content: 'Day badges show how far along each cycle is. Orange = Day 5+ (needs attention), yellow = Day 3-4, blue = Day 1-2.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="cycle-card"]',
    title: 'Cycle at a Glance',
    content: 'Each card shows the patient alias, cycle code, type, and a summary of all embryos in that cycle.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="embryo-grid"]',
    title: 'Embryo Status Colors',
    content: 'Blue = in culture (with grade), cyan/❄ = vitrified, green/→ = transferred, gray/✗ = discarded. Quickly see the state of every embryo.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="new-cycle"]',
    title: 'Create a Cycle',
    content: 'Start a new cycle by selecting a patient (or creating one), entering a cycle code, and choosing the cycle type.',
    skipBeacon: true,
    roles: ALL,
    route: '/',
  },
  {
    target: '[data-tour="embryo-table"]',
    title: 'Full Embryo List',
    content: 'Inside a cycle, you see each embryo with its current day, grade, hours post-insemination, and disposition status. Click any embryo to see its full history.',
    skipBeacon: true,
    roles: ALL,
    route: null,
  },
  {
    target: '[data-tour="add-embryos"]',
    title: 'Add Embryos',
    content: 'After egg retrieval, batch-add embryos to a cycle. Choose how many and their source (fresh or frozen).',
    skipBeacon: true,
    roles: ALL,
    route: null,
  },
  {
    target: '[data-tour="grade-history"]',
    title: 'Grading History',
    content: 'View the complete grading progression: fertilization check (2PN), cleavage grade (8c), and blastocyst grade (4AB Gardner scale).',
    skipBeacon: true,
    roles: ALL,
    route: null,
  },
  {
    target: '[data-tour="checklist-runner"]',
    title: 'Procedure Checklists',
    content: 'Execute step-by-step procedure checklists. Each item is completed in order with a progress indicator.',
    skipBeacon: true,
    roles: ALL,
    route: null,
  },
  {
    target: '[data-tour="action-buttons"]',
    title: 'Disposition Actions',
    content: 'Senior embryologists can grade, observe, vitrify, transfer, or discard embryos. Each action is recorded as an immutable event.',
    skipBeacon: true,
    roles: SENIOR_PLUS,
    route: null,
  },
  {
    target: '[data-tour="event-timeline"]',
    title: 'Audit Trail',
    content: 'Every action on an embryo is recorded here — grading, disposition changes, observations. This is the complete audit trail.',
    skipBeacon: true,
    roles: SENIOR_PLUS,
    route: null,
  },
  {
    target: '[data-tour="settings-templates"]',
    title: 'Checklist Templates',
    content: 'Create and manage checklist templates for lab procedures (IVF, ICSI, FET, etc.). Toggle templates active or inactive.',
    skipBeacon: true,
    roles: MANAGER_PLUS,
    route: '/settings',
  },
  {
    target: '[data-tour="settings-storage"]',
    title: 'Storage Locations',
    content: 'Manage your lab\'s cryo storage hierarchy — rooms, tanks, canisters, canes. Track capacity and managed locations.',
    skipBeacon: true,
    roles: MANAGER_PLUS,
    route: '/settings',
  },
  {
    target: '[data-tour="settings-users"]',
    title: 'User Management',
    content: 'Add staff members, assign roles (embryologist, senior, lab manager, admin), and activate or deactivate accounts.',
    skipBeacon: true,
    roles: ADMIN_ONLY,
    route: '/settings',
  },
]

export type { TourStep }

export function getStepsForRole(role: string): TourStep[] {
  return tourSteps.filter(
    (step) => step.roles.length === 0 || step.roles.includes(role)
  )
}
