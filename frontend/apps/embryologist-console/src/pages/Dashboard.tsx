import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTodayCycles } from '../hooks/useCycles'
import type { CycleDetail, EmbryoSummary } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentDay(inseminationTime: string | null): number | null {
  if (!inseminationTime) return null
  const hours = (Date.now() - new Date(inseminationTime).getTime()) / (1000 * 60 * 60)
  return Math.floor(hours / 24)
}

function formatGrade(embryo: EmbryoSummary): string {
  if (!embryo.latest_grade) return '--'
  // Grade data is nested inside .data when coming from the API
  const raw = embryo.latest_grade as Record<string, unknown>
  const g = (raw.data ?? raw) as Record<string, unknown>
  if (g.expansion) return `${g.expansion}${g.icm ?? ''}${g.te ?? ''}` // blastocyst: "4AB"
  if (g.cell_count) return `${g.cell_count}c` // cleavage: "8c"
  if (g.pronuclei) return String(g.pronuclei).toUpperCase() // fertilization: "2PN"
  return '--'
}

function dispositionIcon(disposition: string): string {
  switch (disposition) {
    case 'vitrified':
      return '❄'
    case 'transferred':
      return '→'
    case 'discarded':
      return '✗'
    default:
      return ''
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sortByUrgency(cycles: CycleDetail[]): CycleDetail[] {
  return [...cycles].sort((a, b) => {
    const dayA = getCurrentDay(a.insemination_time) ?? -1
    const dayB = getCurrentDay(b.insemination_time) ?? -1
    return dayB - dayA
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmbryoBox({ embryo }: { embryo: EmbryoSummary }) {
  const isInCulture = embryo.disposition === 'in_culture'
  const icon = dispositionIcon(embryo.disposition)
  const grade = isInCulture ? formatGrade(embryo) : null

  return (
    <div
      title={`${embryo.embryo_code} · ${embryo.disposition}`}
      className={[
        'flex items-center justify-center w-10 h-10 rounded border text-xs font-medium select-none',
        isInCulture
          ? 'bg-blue-50 border-blue-200 text-blue-800'
          : embryo.disposition === 'vitrified'
            ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
            : embryo.disposition === 'transferred'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-400',
      ].join(' ')}
    >
      {isInCulture ? grade : icon}
    </div>
  )
}

function CycleCard({ cycle, first }: { cycle: CycleDetail; first?: boolean }) {
  const currentDay = getCurrentDay(cycle.insemination_time)
  const summary = cycle.summary as {
    total_embryos?: number
    in_culture?: number
    vitrified?: number
    transferred?: number
    discarded?: number
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5" data-tour={first ? 'cycle-card' : undefined}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">
              {(cycle as unknown as Record<string, unknown>).patient_alias_code as string || cycle.cycle_code}
            </span>
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {cycle.cycle_code}
            </span>
            <span className="text-xs text-gray-500 capitalize">{cycle.cycle_type}</span>
          </div>
          {cycle.assigned_embryologist_id && (
            <p className="text-xs text-gray-400 mt-0.5">Assigned</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
          {currentDay !== null && (
            <span
              data-tour={first ? 'day-badge' : undefined}
              className={[
                'text-sm font-bold px-2 py-0.5 rounded-full',
                currentDay >= 5
                  ? 'bg-orange-100 text-orange-700'
                  : currentDay >= 3
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700',
              ].join(' ')}
            >
              Day {currentDay}
            </span>
          )}
          <Link
            to={`/cycles/${cycle.id}`}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            View detail →
          </Link>
        </div>
      </div>

      {/* Embryo mini-grid */}
      {cycle.embryos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3" data-tour={first ? 'embryo-grid' : undefined}>
          {cycle.embryos.map((embryo) => (
            <EmbryoBox key={embryo.id} embryo={embryo} />
          ))}
        </div>
      )}

      {/* Summary line */}
      <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
        {summary.in_culture != null && summary.in_culture > 0 && (
          <span className="text-blue-600 font-medium">{summary.in_culture} in culture</span>
        )}
        {summary.vitrified != null && summary.vitrified > 0 && (
          <span className="text-cyan-600">❄ {summary.vitrified} vitrified</span>
        )}
        {summary.transferred != null && summary.transferred > 0 && (
          <span className="text-green-600">→ {summary.transferred} transferred</span>
        )}
        {summary.discarded != null && summary.discarded > 0 && (
          <span className="text-gray-400">✗ {summary.discarded} discarded</span>
        )}
        {summary.total_embryos != null && (
          <span className="ml-auto text-gray-400">{summary.total_embryos} total</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { data, isLoading, isError, error } = useTodayCycles()

  const cycles = data ? sortByUrgency(data.cycles) : []
  const displayDate = data?.date ? formatDate(data.date) : formatDate(new Date().toISOString())

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div data-tour="dashboard-header" className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">{displayDate}</p>
          <p className="text-sm text-gray-400">
            Welcome, {user?.full_name || user?.role || 'Embryologist'}
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg
            className="animate-spin h-6 w-6 mr-3 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading today's cycles…</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          <p className="font-medium">Failed to load cycles</p>
          <p className="text-sm mt-1 text-red-500">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && cycles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          <svg
            className="w-12 h-12 mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="font-medium text-gray-500">No active cycles today</p>
          <p className="text-sm mt-1">Active cycles with embryos in culture will appear here.</p>
        </div>
      )}

      {/* Cycle cards */}
      {!isLoading && !isError && cycles.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {cycles.length} active {cycles.length === 1 ? 'cycle' : 'cycles'}
          </p>
          {cycles.map((cycle, idx) => (
            <CycleCard key={cycle.id} cycle={cycle} first={idx === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
