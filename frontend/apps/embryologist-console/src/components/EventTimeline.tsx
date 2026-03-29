import type { EmbryoEvent } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<string, string> = {
  fertilization_check: 'Fertilization check',
  cleavage_grade: 'Cleavage grade',
  blastocyst_grade: 'Blastocyst grade',
  disposition_change: 'Disposition change',
  observation: 'Observation',
  vitrification: 'Vitrification',
  warming: 'Warming',
  transfer: 'Transfer',
  discard: 'Discard',
  created: 'Created',
}

function formatEventLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, ' ')
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

interface GradeData {
  expansion?: number
  icm?: string
  te?: string
  cell_count?: number
  fragmentation?: string
  symmetry?: string
  multinucleation?: boolean
  pronuclei?: string
  polar_bodies?: number
}

function formatEventData(eventType: string, data: Record<string, unknown>): string | null {
  const d = data as GradeData

  if (eventType === 'blastocyst_grade') {
    const parts: string[] = []
    if (d.expansion != null) parts.push(`Exp:${d.expansion}`)
    if (d.icm) parts.push(`ICM:${d.icm}`)
    if (d.te) parts.push(`TE:${d.te}`)
    if (parts.length === 0) return null
    const grade =
      d.expansion != null && d.icm && d.te
        ? `${d.expansion}${d.icm}${d.te}`
        : parts.join(' ')
    return grade + (parts.length === 3 ? ` (${parts.join(' ')})` : '')
  }

  if (eventType === 'cleavage_grade') {
    const parts: string[] = []
    if (d.cell_count != null) parts.push(`${d.cell_count}c`)
    if (d.fragmentation) parts.push(`Grade ${d.fragmentation}`)
    if (d.symmetry) parts.push(d.symmetry)
    if (d.multinucleation) parts.push('MN+')
    return parts.length > 0 ? parts.join(' / ') : null
  }

  if (eventType === 'fertilization_check') {
    const parts: string[] = []
    if (d.pronuclei) parts.push(`${d.pronuclei.toUpperCase()}`)
    if (d.polar_bodies != null) parts.push(`${d.polar_bodies} PB`)
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Generic: show any top-level string / number values
  const entries = Object.entries(data)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
  return entries.length > 0 ? entries.join(' · ') : null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: EmbryoEvent }) {
  const { date, time } = formatDateTime(event.observed_at)
  const summary = formatEventData(event.event_type, event.data)

  return (
    <div className="flex gap-4 py-3">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-white" />
        <div className="flex-1 w-px bg-gray-200 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {date} {time}
          </span>
          <span className="text-sm font-medium text-gray-800">
            {formatEventLabel(event.event_type)}
          </span>
          <span className="text-xs text-gray-400">Day {event.event_day}</span>
          {event.time_hpi != null && (
            <span className="text-xs text-gray-400">{event.time_hpi.toFixed(1)}h HPI</span>
          )}
        </div>

        {summary && (
          <p className="mt-0.5 text-sm text-gray-700 font-mono">{summary}</p>
        )}

        {event.notes && (
          <p className="mt-0.5 text-sm text-gray-500 italic">
            &ldquo;{event.notes}&rdquo;
            {event.performed_by && (
              <span className="not-italic text-gray-400"> — {event.performed_by}</span>
            )}
          </p>
        )}
        {!event.notes && event.performed_by && (
          <p className="mt-0.5 text-xs text-gray-400">by {event.performed_by}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventTimelineProps {
  events: EmbryoEvent[]
}

export default function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">No events recorded yet.</p>
    )
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime(),
  )

  return (
    <div className="divide-y divide-gray-100">
      {sorted.map((event, idx) => (
        <EventRow key={event.id ?? idx} event={event} />
      ))}
    </div>
  )
}
