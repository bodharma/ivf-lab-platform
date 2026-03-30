import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePatients, useCreatePatient } from '../hooks/usePatients'
import { useCreateCycle } from '../hooks/useCycles'

const CYCLE_TYPES = ['fresh_icsi', 'fresh_ivf', 'frozen_et']

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export default function NewCycleModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data: patients = [], isLoading: patientsLoading } = usePatients()
  const createPatient = useCreatePatient()
  const createCycle = useCreateCycle()

  const [patientId, setPatientId] = useState('')
  const [cycleCode, setCycleCode] = useState('')
  const [cycleType, setCycleType] = useState('fresh_icsi')
  const [startDate, setStartDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)

  const handleNewPatient = async () => {
    setError(null)
    const nextNum = patients.length + 1
    const code = `PAT-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`
    try {
      const patient = await createPatient.mutateAsync(code)
      setPatientId(patient.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
      return
    }
    try {
      const cycle = await createCycle.mutateAsync({
        patient_alias_id: patientId,
        cycle_code: cycleCode,
        cycle_type: cycleType,
        start_date: startDate,
      })
      onClose()
      navigate(`/cycles/${cycle.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cycle')
    }
  }

  const isPending = createCycle.isPending || createPatient.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Cycle</h2>
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
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Alias</label>
            <div className="flex gap-2">
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={patientsLoading}
              >
                <option value="">Select patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.alias_code}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNewPatient}
                disabled={isPending}
                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
              >
                + New Patient
              </button>
            </div>
          </div>

          {/* Cycle Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Code</label>
            <input
              type="text"
              required
              value={cycleCode}
              onChange={(e) => setCycleCode(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="CYC-2026-0004"
            />
          </div>

          {/* Cycle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Type</label>
            <select
              value={cycleType}
              onChange={(e) => setCycleType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CYCLE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
