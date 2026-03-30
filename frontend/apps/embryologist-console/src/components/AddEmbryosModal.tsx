import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

const SOURCES = ['fresh', 'frozen']

export default function AddEmbryosModal({
  cycleId,
  existingCount,
  onClose,
}: {
  cycleId: string
  existingCount: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [count, setCount] = useState(1)
  const [source, setSource] = useState('fresh')
  const [error, setError] = useState<string | null>(null)

  const startIndex = existingCount + 1
  const codes = Array.from({ length: count }, (_, i) => `E${startIndex + i}`)

  const mutation = useMutation({
    mutationFn: async () => {
      for (const code of codes) {
        await api.post(`/cycles/${cycleId}/embryos`, {
          embryo_code: code,
          source,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', cycleId] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Embryos</h2>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Embryos</label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
              {codes.map((code) => (
                <span
                  key={code}
                  className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded"
                >
                  {code}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {count} embryo{count > 1 ? 's' : ''} will be created as "{source}" with disposition "in culture"
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? `Adding ${count}...` : `Add ${count} Embryo${count > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
