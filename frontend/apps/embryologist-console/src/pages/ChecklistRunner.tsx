import { useParams, useNavigate } from 'react-router-dom'
import { useChecklist, useChecklistTemplates, useCompleteItem } from '../hooks/useChecklists'
import type { ChecklistTemplate } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Completed
        </span>
      )
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          In Progress
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
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

  const isLoading = instanceLoading || templatesLoading

  // Find the matching template for this checklist instance
  const template: ChecklistTemplate | undefined = templates?.find(
    (t) => t.id === instance?.template_id,
  )

  // Build a set of completed item indices for O(1) lookup
  const completedIndices = new Set((instance?.items ?? []).map((item) => item.item_index))

  const templateItems = template?.items ?? []
  const totalItems = templateItems.length
  const completedCount = completedIndices.size

  // The next uncompleted item index (by order)
  const nextItemOrder = templateItems
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((item) => !completedIndices.has(item.order))?.order ?? null

  const allCompleted = totalItems > 0 && completedCount === totalItems
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading checklist…</span>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
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
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {instance.cycle_id}
                </span>
                {instance.completed_by && (
                  <span className="text-xs text-gray-500">Dr. {instance.completed_by}</span>
                )}
              </div>
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
                className={[
                  'h-2 rounded-full transition-all duration-500',
                  allCompleted ? 'bg-green-500' : 'bg-blue-500',
                ].join(' ')}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Completion banner */}
        {allCompleted && (
          <div className="mx-6 mt-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <svg
              className="w-5 h-5 text-green-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
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
        <div className="p-6">
          {templateItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No items found in this checklist template.
            </p>
          ) : (
            <ol className="space-y-2">
              {templateItems
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((item) => {
                  const isDone = completedIndices.has(item.order)
                  const isNext = !allCompleted && item.order === nextItemOrder

                  return (
                    <li
                      key={item.order}
                      className={[
                        'flex items-center gap-3 rounded-lg px-4 py-3 transition-colors',
                        isDone
                          ? 'bg-gray-50'
                          : isNext
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-white border border-transparent',
                      ].join(' ')}
                    >
                      {/* Status icon */}
                      <span className="shrink-0 text-lg leading-none select-none">
                        {isDone ? '✅' : '⬜'}
                      </span>

                      {/* Step number + label */}
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
                        {item.required && !isDone && (
                          <span className="ml-1 text-xs text-red-400">*</span>
                        )}
                      </span>

                      {/* Complete button — only on the next uncompleted item */}
                      {isNext && (
                        <button
                          onClick={() => completeItem(item.order)}
                          disabled={completing}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {completing ? 'Saving…' : 'Complete'}
                        </button>
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
