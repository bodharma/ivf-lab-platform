import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCycleDetail, useCycleChecklists } from '../hooks/useEmbryos'
import { api } from '../api/client'
import type { EmbryoSummary, EmbryoEvent, ChecklistInstance, ChecklistTemplate } from '../types'

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatRecentActivityDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Compute hours post insemination from cycle.insemination_time */
function computeHPI(inseminationTime: string | null | undefined): string {
  if (!inseminationTime) return '--'
  const insemDt = new Date(inseminationTime)
  const now = new Date()
  const diffMs = now.getTime() - insemDt.getTime()
  if (diffMs < 0) return '--'
  const hours = diffMs / (1000 * 60 * 60)
  return `${hours.toFixed(1)}h`
}

/** Format grade from latest_grade record, mirroring Dashboard conventions */
function formatGrade(latestGrade: Record<string, unknown> | null | undefined): string {
  if (!latestGrade) return '--'
  // Grade data is nested inside .data when coming from the API
  const g = (latestGrade.data ?? latestGrade) as Record<string, unknown>

  // Gardner blastocyst: expansion + icm + te → e.g. "4AB"
  if (g.expansion !== undefined) {
    return `${g.expansion}${g.icm ?? ''}${g.te ?? ''}`
  }

  // Cleavage: cell_count → e.g. "8c"
  if (g.cell_count !== undefined) {
    return `${g.cell_count}c`
  }

  // Fertilization: pronuclei → e.g. "2PN"
  if (g.pronuclei !== undefined) {
    return String(g.pronuclei).toUpperCase()
  }

  return '--'
}

/** Infer current day from insemination_time */
function computeDay(inseminationTime: string | null | undefined): string {
  if (!inseminationTime) return '--'
  const insemDt = new Date(inseminationTime)
  const now = new Date()
  const diffMs = now.getTime() - insemDt.getTime()
  if (diffMs < 0) return '--'
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return String(days + 1) // Day 1 = fertilization day
}

// ── status badges ──────────────────────────────────────────────────────────

const DISPOSITION_COLORS: Record<string, string> = {
  in_culture: 'bg-green-100 text-green-800',
  vitrified: 'bg-blue-100 text-blue-800',
  transferred: 'bg-purple-100 text-purple-800',
  discarded: 'bg-red-100 text-red-800',
  arrested: 'bg-orange-100 text-orange-800',
}

const CHECKLIST_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

function DispositionBadge({ status }: { status: string }) {
  const colorClass = DISPOSITION_COLORS[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ChecklistStatusBadge({ status }: { status: string }) {
  const colorClass = CHECKLIST_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── sub-sections ───────────────────────────────────────────────────────────

function EmbryoTable({
  embryos,
  inseminationTime,
}: {
  embryos: EmbryoSummary[]
  inseminationTime: string | null | undefined
}) {
  const hpi = computeHPI(inseminationTime)
  const day = computeDay(inseminationTime)

  if (embryos.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No embryos recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Code
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Day
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Grade
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              HPI
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {embryos.map((embryo) => (
            <tr key={embryo.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-blue-600">
                <Link to={`/embryos/${embryo.id}`} className="hover:underline">
                  {embryo.embryo_code}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{day}</td>
              <td className="px-4 py-3 text-sm font-mono text-gray-800">
                {formatGrade(embryo.latest_grade)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{hpi}</td>
              <td className="px-4 py-3">
                <DispositionBadge status={embryo.disposition} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NewChecklistButton({ cycleId }: { cycleId: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: templates = [] } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get<ChecklistTemplate[]>('/checklist-templates'),
  })

  const createMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post<ChecklistInstance>(`/cycles/${cycleId}/checklists`, { template_id: templateId }),
    onSuccess: (instance) => {
      void qc.invalidateQueries({ queryKey: ['cycles', cycleId, 'checklists'] })
      navigate(`/checklists/${instance.id}`)
    },
  })

  if (templates.length === 0) return null

  return (
    <select
      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) createMutation.mutate(e.target.value)
      }}
      disabled={createMutation.isPending}
    >
      <option value="" disabled>{createMutation.isPending ? 'Creating...' : '+ New Checklist'}</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}

function ChecklistsSection({ checklists }: { checklists: ChecklistInstance[] }) {
  if (checklists.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No checklists for this cycle.</p>
  }

  const statusIcon = (status: string) => {
    if (status === 'completed') return '✅'
    if (status === 'in_progress') return '🔄'
    return '⬜'
  }

  return (
    <ul className="divide-y divide-gray-100">
      {checklists.map((cl) => (
        <li key={cl.id} className="flex items-center justify-between py-3 px-1">
          <div className="flex items-center gap-3">
            <span className="text-base">{statusIcon(cl.status)}</span>
            <Link
              to={`/checklists/${cl.id}`}
              className="text-sm font-medium text-gray-800 hover:text-blue-600 hover:underline"
            >
              Checklist
              {cl.items.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({cl.items.length} items completed)
                </span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ChecklistStatusBadge status={cl.status} />
            {cl.status === 'pending' && (
              <Link
                to={`/checklists/${cl.id}`}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Start
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── main page ──────────────────────────────────────────────────────────────

export default function CycleView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const cycleId = id ?? ''

  const { data: cycle, isLoading: cycleLoading, error: cycleError } = useCycleDetail(cycleId)
  const { data: checklists = [], isLoading: checklistsLoading } = useCycleChecklists(cycleId)

  // Fetch recent events for all embryos in this cycle
  const { data: allEvents = [] } = useQuery({
    queryKey: ['cycles', cycleId, 'events'],
    queryFn: async () => {
      if (!cycle?.embryos?.length) return []
      const results = await Promise.all(
        cycle.embryos.map((em: EmbryoSummary) =>
          api.get<EmbryoEvent[]>(`/embryos/${em.id}/events`).then(events =>
            events.map(ev => ({ ...ev, _embryo_code: em.embryo_code }))
          )
        )
      )
      return results
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
    },
    enabled: !!cycle?.embryos?.length,
  })

  if (cycleLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-400 text-sm">Loading cycle…</div>
      </div>
    )
  }

  if (cycleError || !cycle) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1"
        >
          ← Back to Today
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {cycleError instanceof Error ? cycleError.message : 'Failed to load cycle.'}
        </div>
      </div>
    )
  }

  const recentActivity = allEvents as (EmbryoEvent & { _embryo_code: string })[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1"
        >
          ← Back to Today
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {(cycle as unknown as Record<string, unknown>).patient_alias_code as string || cycle.cycle_code}
              <span className="text-gray-400 font-normal mx-2">·</span>
              {cycle.cycle_code}
            </h1>
          </div>
          <span
            className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              cycle.status === 'active'
                ? 'bg-green-100 text-green-800'
                : cycle.status === 'completed'
                ? 'bg-gray-100 text-gray-600'
                : cycle.status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {cycle.status}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 w-28">Type</dt>
            <dd className="text-gray-800">{cycle.cycle_type.replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 w-28">Start</dt>
            <dd className="text-gray-800">{formatDate(cycle.start_date)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 w-28">Retrieval</dt>
            <dd className="text-gray-800">{formatDate(cycle.retrieval_date)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 w-28">Insemination</dt>
            <dd className="text-gray-800">{formatDateTime(cycle.insemination_time)}</dd>
          </div>
          {cycle.assigned_embryologist_id && (
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500 w-28">Assigned</dt>
              <dd className="text-gray-800">Assigned</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Embryo table */}
      <section data-tour="embryo-table" className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Embryos
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({cycle.embryos?.length ?? 0})
            </span>
          </h2>
          {cycle.embryos && cycle.embryos.length > 0 && (
            <select
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) navigate(`/embryos/${e.target.value}`)
              }}
            >
              <option value="" disabled>+ Record Event</option>
              {cycle.embryos
                .filter((em: EmbryoSummary) => em.disposition === 'in_culture')
                .map((em: EmbryoSummary) => (
                  <option key={em.id} value={em.id}>
                    {em.embryo_code} — Grade / Observe / Dispose
                  </option>
                ))}
            </select>
          )}
        </div>
        <div className="px-5 py-2">
          <EmbryoTable
            embryos={cycle.embryos ?? []}
            inseminationTime={cycle.insemination_time}
          />
        </div>
      </section>

      {/* Checklists */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Checklists
            {checklistsLoading && (
              <span className="ml-2 text-xs font-normal text-gray-400">Loading...</span>
            )}
          </h2>
          <NewChecklistButton cycleId={cycleId} />
        </div>
        <div className="px-5 py-2">
          <ChecklistsSection checklists={checklists} />
        </div>
      </section>

      {/* Recent Activity */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Recent Activity</h2>
        </div>
        <div className="px-5 py-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No recorded events yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentActivity.map((ev) => (
                <li key={ev.id} className="py-3 flex items-center gap-3 text-sm">
                  <span className="text-gray-400 tabular-nums w-36 shrink-0">
                    {formatRecentActivityDate(ev.created_at)}
                  </span>
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-blue-600 font-medium">
                    <Link to={`/embryos/${ev.embryo_id}`} className="hover:underline">
                      {ev._embryo_code}
                    </Link>
                  </span>
                  <span className="text-gray-500">
                    Day {ev.event_day}
                    {ev.time_hpi != null && ` · ${ev.time_hpi.toFixed(1)}h HPI`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
