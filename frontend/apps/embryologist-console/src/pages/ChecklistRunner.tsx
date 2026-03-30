import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useChecklist, useChecklistTemplates, useCompleteItem } from '../hooks/useChecklists'
import { api } from '../api/client'
import type { ChecklistTemplate, EmbryoSummary, CycleDetail } from '../types'
import GradeForm from '../components/GradeForm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Completed
        </span>
      )
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          In Progress
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Pending
        </span>
      )
  }
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '--'
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Keywords that indicate an item is embryo-assessment related
const EMBRYO_KEYWORDS = ['assess', 'grade', 'record grade', 'embryo', 'decision', 'transfer', 'freeze', 'discard']

function isEmbryoRelatedItem(label: string): boolean {
  const lower = label.toLowerCase()
  return EMBRYO_KEYWORDS.some((kw) => lower.includes(kw))
}

function computeCurrentDay(inseminationTime: string | null): number {
  if (!inseminationTime) return 0
  const hours = (Date.now() - new Date(inseminationTime).getTime()) / (1000 * 60 * 60)
  return Math.max(0, Math.floor(hours / 24))
}

interface GradeInfo {
  expansion?: number
  icm?: string
  te?: string
  cell_count?: number
  pronuclei?: string
}

function formatGrade(grade: Record<string, unknown> | null): string {
  if (!grade) return 'Not graded'
  const g = grade as GradeInfo
  if (g.expansion) return `${g.expansion}${g.icm ?? ''}${g.te ?? ''}`
  if (g.cell_count) return `${g.cell_count}c`
  if (g.pronuclei) return String(g.pronuclei)
  return 'Graded'
}

// ---------------------------------------------------------------------------
// Embryo Panel (shown inline for assessment steps)
// ---------------------------------------------------------------------------

function EmbryoPanel({
  embryos,
  currentDay,
}: {
  embryos: EmbryoSummary[]
  currentDay: number
}) {
  const [gradingEmbryoId, setGradingEmbryoId] = useState<string | null>(null)

  const inCulture = embryos.filter((e) => e.disposition === 'in_culture')
  const graded = inCulture.filter((e) => e.latest_grade !== null)
  const ungraded = inCulture.filter((e) => e.latest_grade === null)

  return (
    <div className="mt-3 ml-9 bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">
          {graded.length}/{inCulture.length} embryos graded today
        </p>
        {ungraded.length === 0 && inCulture.length > 0 && (
          <span className="text-xs text-green-600 font-medium">All graded</span>
        )}
      </div>

      <div className="space-y-2">
        {inCulture.map((embryo) => {
          const hasGrade = embryo.latest_grade !== null
          const isGrading = gradingEmbryoId === embryo.id

          return (
            <div key={embryo.id} className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono font-medium ${hasGrade ? 'text-green-700' : 'text-gray-700'}`}>
                    {embryo.embryo_code}
                  </span>
                  {hasGrade ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                      {formatGrade(embryo.latest_grade)}
                    </span>
                  ) : (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                      Needs grading
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!hasGrade && !isGrading && (
                    <button
                      onClick={() => setGradingEmbryoId(embryo.id)}
                      className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Grade
                    </button>
                  )}
                  <Link
                    to={`/embryos/${embryo.id}`}
                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-blue-600 hover:underline"
                  >
                    Detail
                  </Link>
                </div>
              </div>

              {/* Inline grade form */}
              {isGrading && (
                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <GradeForm
                    embryoId={embryo.id}
                    currentDay={currentDay}
                    onSuccess={() => setGradingEmbryoId(null)}
                    onCancel={() => setGradingEmbryoId(null)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick links to non-culture embryos */}
      {embryos.filter((e) => e.disposition !== 'in_culture').length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            {embryos.filter((e) => e.disposition === 'vitrified').length > 0 &&
              `${embryos.filter((e) => e.disposition === 'vitrified').length} vitrified`}
            {embryos.filter((e) => e.disposition === 'discarded').length > 0 &&
              ` · ${embryos.filter((e) => e.disposition === 'discarded').length} discarded`}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChecklistRunner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const checklistId = id ?? ''

  const {
    data: instance,
    isLoading: instanceLoading,
    isError: instanceError,
    error: instanceErr,
  } = useChecklist(checklistId)

  const { data: templates, isLoading: templatesLoading } = useChecklistTemplates()

  const { mutate: completeItem, isPending: completing } = useCompleteItem(checklistId)

  // Fetch cycle data for embryo context
  const { data: cycle } = useQuery({
    queryKey: ['cycles', instance?.cycle_id],
    queryFn: () => api.get<CycleDetail>(`/cycles/${instance!.cycle_id}`),
    enabled: !!instance?.cycle_id,
  })

  const isLoading = instanceLoading || templatesLoading

  const template: ChecklistTemplate | undefined = templates?.find(
    (t) => t.id === instance?.template_id,
  )

  const completedIndices = new Set((instance?.items ?? []).map((item) => item.item_index))

  const templateItems = template?.items ?? []
  const totalItems = templateItems.length
  const completedCount = completedIndices.size

  const sortedItems = [...templateItems].sort((a, b) => a.order - b.order)
  const nextItemOrder = sortedItems.find((item) => !completedIndices.has(item.order))?.order ?? null

  const allCompleted = totalItems > 0 && completedCount === totalItems
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0

  const currentDay = computeCurrentDay(cycle?.insemination_time ?? null)
  const embryos = cycle?.embryos ?? []

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading checklist...</span>
        </div>
      </div>
    )
  }

  if (instanceError || !instance) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          <p className="font-medium">Failed to load checklist</p>
          <p className="text-sm mt-1 text-red-500">
            {instanceErr instanceof Error ? instanceErr.message : 'An unexpected error occurred.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(`/cycles/${instance.cycle_id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Cycle
      </button>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {template?.name ?? 'Checklist'}
              </h1>
              {cycle && (
                <p className="text-xs text-gray-500 mt-1">
                  {cycle.cycle_code} · Day {currentDay}
                  {cycle.insemination_time && ` · ${embryos.length} embryos`}
                </p>
              )}
              {instance.started_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Started: {formatTime(instance.started_at)}
                </p>
              )}
            </div>
            <div className="shrink-0">{statusBadge(instance.status)}</div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Progress</span>
              <span className="text-xs font-semibold text-gray-700">
                {completedCount}/{totalItems}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${allCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Completion banner */}
        {allCompleted && (
          <div className="mx-6 mt-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800">Checklist Complete</p>
              {instance.completed_at && (
                <p className="text-xs text-green-600 mt-0.5">
                  Finished at {formatTime(instance.completed_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Item list */}
        <div data-tour="checklist-runner" className="p-6">
          {templateItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No items found in this checklist template.
            </p>
          ) : (
            <ol className="space-y-2">
              {sortedItems.map((item) => {
                const isDone = completedIndices.has(item.order)
                const isNext = !allCompleted && item.order === nextItemOrder
                const showEmbryos = isEmbryoRelatedItem(item.label) && embryos.length > 0

                return (
                  <li key={item.order}>
                    <div
                      className={[
                        'flex items-center gap-3 rounded-lg px-4 py-3 transition-colors',
                        isDone
                          ? 'bg-gray-50'
                          : isNext
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-white border border-transparent',
                      ].join(' ')}
                    >
                      <span className="shrink-0 text-lg leading-none select-none">
                        {isDone ? '✅' : '⬜'}
                      </span>

                      <span
                        className={[
                          'flex-1 text-sm',
                          isDone
                            ? 'text-gray-400 line-through'
                            : isNext
                              ? 'text-blue-900 font-medium'
                              : 'text-gray-700',
                        ].join(' ')}
                      >
                        <span className="text-gray-400 mr-1.5">{item.order}.</span>
                        {item.label}
                      </span>

                      {isNext && (
                        <button
                          onClick={() => completeItem(item.order)}
                          disabled={completing}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {completing ? 'Saving...' : 'Complete'}
                        </button>
                      )}
                    </div>

                    {/* Inline embryo panel for assessment-related steps */}
                    {showEmbryos && (isNext || isDone) && (
                      <EmbryoPanel embryos={embryos} currentDay={currentDay} />
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
