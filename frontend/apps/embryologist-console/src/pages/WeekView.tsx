import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CycleWeekDay } from '../types'

function formatDayHeader(dateStr: string): { weekday: string; date: string; isToday: boolean } {
  const d = new Date(dateStr)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday,
  }
}

function useWeekCycles() {
  return useQuery({
    queryKey: ['cycles', 'week'],
    queryFn: () => api.get<CycleWeekDay[]>('/cycles/week'),
    refetchInterval: 60_000,
  })
}

export default function WeekView() {
  const { data, isLoading, isError, error } = useWeekCycles()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">This Week</h1>
        <p className="text-sm text-gray-500 mt-0.5">Scheduled assessments for the next 7 days</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading week schedule…</span>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          <p className="font-medium">Failed to load week schedule</p>
          <p className="text-sm mt-1 text-red-500">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-4">
          {data.map((day) => {
            const { weekday, date, isToday } = formatDayHeader(day.date)
            return (
              <div
                key={day.date}
                className={`bg-white rounded-xl border shadow-sm ${isToday ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}
              >
                {/* Day header */}
                <div
                  className={`flex items-center gap-3 px-5 py-3 border-b ${isToday ? 'border-blue-100 bg-blue-50 rounded-t-xl' : 'border-gray-100'}`}
                >
                  <span className={`font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                    {weekday}
                  </span>
                  <span className={`text-sm ${isToday ? 'text-blue-500' : 'text-gray-400'}`}>{date}</span>
                  {isToday && (
                    <span className="ml-auto text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Today
                    </span>
                  )}
                </div>

                {/* Cycles */}
                <div className="p-4">
                  {day.cycles.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-1">No assessments</p>
                  ) : (
                    <div className="space-y-2">
                      {day.cycles.map((cycle) => (
                        <div
                          key={cycle.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900 text-sm">
                              {cycle.patient_alias_id}
                            </span>
                            <span className="text-xs font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              {cycle.cycle_code}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{cycle.cycle_type}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                cycle.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : cycle.status === 'planned'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {cycle.status}
                            </span>
                          </div>
                          <Link
                            to={`/cycles/${cycle.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                          >
                            View →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
