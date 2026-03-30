import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Embryo, EmbryoEvent, CycleDetail } from '../types'
import EventTimeline from '../components/EventTimeline'
import GradeForm from '../components/GradeForm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbryoWithEvents extends Embryo {
  events?: EmbryoEvent[]
}

type ActionType = 'grade' | 'observe' | 'vitrify' | 'transfer' | 'discard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCurrentDay(inseminationTime: string | null): number {
  if (!inseminationTime) return 0
  const hours = (Date.now() - new Date(inseminationTime).getTime()) / (1000 * 60 * 60)
  return Math.max(0, Math.floor(hours / 24))
}

function computeHPI(inseminationTime: string | null): number | null {
  if (!inseminationTime) return null
  return (Date.now() - new Date(inseminationTime).getTime()) / (1000 * 60 * 60)
}

const GRADING_EVENT_TYPES = new Set([
  'fertilization_check',
  'cleavage_grade',
  'blastocyst_grade',
])

interface GradeDataEntry {
  expansion?: number
  icm?: string
  te?: string
  cell_count?: number
  fragmentation?: string
  symmetry?: string
  pronuclei?: string
}

function formatGradeSummary(event: EmbryoEvent): string {
  const d = event.data as GradeDataEntry
  if (event.event_type === 'blastocyst_grade' && d.expansion != null) {
    const base = `${d.expansion}${d.icm ?? ''}${d.te ?? ''}`
    const details = [
      d.expansion != null ? `Exp:${d.expansion}` : null,
      d.icm ? `ICM:${d.icm}` : null,
      d.te ? `TE:${d.te}` : null,
    ]
      .filter(Boolean)
      .join(' ')
    return `${base} (${details})`
  }
  if (event.event_type === 'cleavage_grade') {
    const parts: string[] = []
    if (d.cell_count != null) parts.push(`${d.cell_count}c`)
    if (d.fragmentation) parts.push(`Grade ${d.fragmentation}`)
    if (d.symmetry) parts.push(d.symmetry)
    return parts.join(' ') || '—'
  }
  if (event.event_type === 'fertilization_check' && d.pronuclei) {
    return d.pronuclei.toUpperCase() + ' normal'
  }
  return '—'
}

function dispositionBadgeClass(disposition: string): string {
  switch (disposition) {
    case 'in_culture':
      return 'bg-blue-100 text-blue-800'
    case 'vitrified':
      return 'bg-cyan-100 text-cyan-700'
    case 'transferred':
      return 'bg-green-100 text-green-700'
    case 'discarded':
      return 'bg-gray-100 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function actionButtonClass(action: ActionType): string {
  switch (action) {
    case 'grade':
      return 'bg-blue-600 hover:bg-blue-700 text-white'
    case 'observe':
      return 'bg-gray-100 hover:bg-gray-200 text-gray-700'
    case 'vitrify':
      return 'bg-cyan-600 hover:bg-cyan-700 text-white'
    case 'transfer':
      return 'bg-green-600 hover:bg-green-700 text-white'
    case 'discard':
      return 'bg-red-100 hover:bg-red-200 text-red-700'
    default:
      return 'bg-gray-100 hover:bg-gray-200 text-gray-700'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <svg className="animate-spin h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span>Loading…</span>
    </div>
  )
}

interface GradeHistoryProps {
  events: EmbryoEvent[]
}

function GradeHistory({ events }: GradeHistoryProps) {
  const gradeEvents = [...events]
    .filter((e) => GRADING_EVENT_TYPES.has(e.event_type))
    .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime())

  if (gradeEvents.length === 0) {
    return <p className="text-sm text-gray-400 py-3 text-center">No grading events yet.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {gradeEvents.map((event, idx) => (
        <div key={event.id ?? idx} className="flex items-center gap-4 py-2.5">
          <span className="text-xs font-medium text-gray-500 w-14 shrink-0">
            Day {event.event_day}
          </span>
          <span className="flex-1 text-sm text-gray-800 font-mono">
            {formatGradeSummary(event)}
          </span>
          {event.time_hpi != null && (
            <span className="text-xs text-gray-400 tabular-nums shrink-0">
              {event.time_hpi.toFixed(1)}h HPI
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action Forms (Observe, Vitrify, Transfer, Discard)
// ---------------------------------------------------------------------------

function ActionForm({
  action,
  embryoId,
  currentDay,
  onSuccess,
  onCancel,
}: {
  action: ActionType
  embryoId: string
  currentDay: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const eventConfig: Record<string, { event_type: string; data: () => Record<string, unknown> }> = {
    observe: {
      event_type: 'observation',
      data: () => ({ note: notes || 'Observation recorded' }),
    },
    vitrify: {
      event_type: 'disposition_change',
      data: () => ({ from: 'in_culture', to: 'vitrified', reason: notes || undefined }),
    },
    transfer: {
      event_type: 'disposition_change',
      data: () => ({ from: 'in_culture', to: 'transferred', reason: notes || undefined }),
    },
    discard: {
      event_type: 'disposition_change',
      data: () => ({ from: 'in_culture', to: 'discarded', reason: reason || notes }),
    },
  }

  const mutation = useMutation({
    mutationFn: () => {
      const cfg = eventConfig[action]
      return api.post(`/embryos/${embryoId}/events`, {
        event_type: cfg.event_type,
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: cfg.data(),
        notes: notes || null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (action === 'discard' && !reason) return; mutation.mutate() }} className="space-y-4">
      {action === 'discard' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason for discard *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="e.g., Poor morphology, arrested development"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Optional notes..."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
            action === 'discard'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : action === 'vitrify'
              ? 'bg-cyan-600 text-white hover:bg-cyan-700'
              : action === 'transfer'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {mutation.isPending ? 'Saving...' : action === 'observe' ? 'Save Observation' : action === 'discard' ? 'Confirm Discard' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
        </button>
      </div>
    </form>
  )
}

interface ActionModalProps {
  action: ActionType
  embryoId: string
  currentDay: number
  onClose: () => void
  onSuccess: () => void
}

function ActionModal({ action, embryoId, currentDay, onClose, onSuccess }: ActionModalProps) {
  const titles: Record<ActionType, string> = {
    grade: 'Record Grade',
    observe: 'Record Observation',
    vitrify: 'Vitrify Embryo',
    transfer: 'Transfer Embryo',
    discard: 'Discard Embryo',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{titles[action]}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {action === 'grade' && (
            <GradeForm
              embryoId={embryoId}
              currentDay={currentDay}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
          {action !== 'grade' && (
            <ActionForm
              action={action}
              embryoId={embryoId}
              currentDay={currentDay}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmbryoDetail() {
  const { id: embryoId } = useParams<{ id: string }>()
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)

  const {
    data: embryo,
    isLoading: embryoLoading,
    isError: embryoError,
    error: embryoErr,
  } = useQuery({
    queryKey: ['embryos', embryoId],
    queryFn: () => api.get<EmbryoWithEvents>(`/embryos/${embryoId}`),
    enabled: !!embryoId,
  })

  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['embryos', embryoId, 'events'],
    queryFn: () => api.get<EmbryoEvent[]>(`/embryos/${embryoId}/events`),
    enabled: !!embryoId,
  })

  const cycleId = embryo?.cycle_id
  const {
    data: cycle,
  } = useQuery({
    queryKey: ['cycles', cycleId],
    queryFn: () => api.get<CycleDetail>(`/cycles/${cycleId}`),
    enabled: !!cycleId,
  })

  const inseminationTime = cycle?.insemination_time ?? null
  const currentDay = computeCurrentDay(inseminationTime)
  const hpi = computeHPI(inseminationTime)

  const isLoading = embryoLoading || eventsLoading

  if (isLoading) return <div className="p-6 max-w-3xl mx-auto"><Spinner /></div>

  if (embryoError || !embryo) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          <p className="font-medium">Failed to load embryo</p>
          <p className="text-sm mt-1 text-red-500">
            {embryoErr instanceof Error ? embryoErr.message : 'An unexpected error occurred.'}
          </p>
        </div>
      </div>
    )
  }

  const backHref = `/cycles/${embryo.cycle_id}`

  const handleActionSuccess = () => {
    setActiveAction(null)
    void refetchEvents()
  }

  const actions: { key: ActionType; label: string }[] = [
    { key: 'grade', label: 'Grade' },
    { key: 'observe', label: 'Observe' },
    { key: 'vitrify', label: 'Vitrify' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'discard', label: 'Discard' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        to={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Cycle
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Embryo {embryo.embryo_code}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${dispositionBadgeClass(embryo.disposition)}`}
            >
              {embryo.disposition.replace(/_/g, ' ')}
            </span>
            {inseminationTime && (
              <>
                <span className="text-sm text-gray-600">
                  Current Day:{' '}
                  <span className="font-semibold text-gray-900">{currentDay}</span>
                </span>
                {hpi != null && (
                  <span className="text-sm text-gray-600">
                    HPI:{' '}
                    <span className="font-semibold text-gray-900">{hpi.toFixed(1)}h</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grade history */}
      <section data-tour="grade-history" className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Grade History
        </h2>
        <GradeHistory events={events} />
      </section>

      {/* Event timeline */}
      <section data-tour="event-timeline" className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Event Timeline
        </h2>
        <EventTimeline events={events} />
      </section>

      {/* Action buttons */}
      <div data-tour="action-buttons" className="flex flex-wrap gap-3">
        {actions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveAction(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${actionButtonClass(key)}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Modal */}
      {activeAction && embryoId && (
        <ActionModal
          action={activeAction}
          embryoId={embryoId}
          currentDay={currentDay}
          onClose={() => setActiveAction(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  )
}
