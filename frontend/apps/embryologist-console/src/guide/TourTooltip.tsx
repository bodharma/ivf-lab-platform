import type { TooltipRenderProps } from 'react-joyride'

export default function TourTooltip({
  continuous,
  index,
  step,
  size,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm"
    >
      <div className="px-5 pt-4 pb-2">
        {step.title && (
          <h3 className="text-base font-semibold text-gray-900">
            {step.title as string}
          </h3>
        )}
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          {step.content as string}
        </p>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <button
          {...skipProps}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip tour
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 tabular-nums">
            {index + 1} / {size}
          </span>

          {index > 0 && (
            <button
              {...backProps}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
          )}

          {continuous && (
            <button
              {...primaryProps}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {index === size - 1 ? 'Finish' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
