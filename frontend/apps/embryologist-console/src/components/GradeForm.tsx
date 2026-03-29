import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GradeFormProps {
  embryoId: string
  currentDay: number
  onSuccess: () => void
  onCancel: () => void
}

function getEventType(currentDay: number): string {
  if (currentDay <= 1) return 'fertilization_check'
  if (currentDay <= 3) return 'cleavage_grade'
  return 'blastocyst_grade'
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function FormActions({
  onCancel,
  isSubmitting,
  error,
}: {
  onCancel: () => void
  isSubmitting: boolean
  error: string | null
}) {
  return (
    <div className="space-y-3 pt-1">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Grade'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day 1: Fertilization Check
// ---------------------------------------------------------------------------

function Day1Form({ embryoId, currentDay, onSuccess, onCancel }: GradeFormProps) {
  const qc = useQueryClient()
  const [pronuclei, setPronuclei] = useState('')
  const [polarBodies, setPolarBodies] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: {
          pronuclei,
          polar_bodies: polarBodies ? parseInt(polarBodies) : undefined,
        },
        notes: notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!pronuclei) return
        mutation.mutate()
      }}
      className="space-y-5"
    >
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Pronuclei *</legend>
        <div className="flex flex-wrap gap-3">
          {['2pn', '1pn', '0pn', '3pn'].map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pronuclei"
                value={val}
                checked={pronuclei === val}
                onChange={() => setPronuclei(val)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800">{val.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Polar bodies</label>
        <input
          type="number"
          min={0}
          max={4}
          value={polarBodies}
          onChange={(e) => setPolarBodies(e.target.value)}
          className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

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

      <FormActions
        onCancel={onCancel}
        isSubmitting={mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Day 2-3: Cleavage Grade
// ---------------------------------------------------------------------------

function Day23Form({ embryoId, currentDay, onSuccess, onCancel }: GradeFormProps) {
  const qc = useQueryClient()
  const [cellCount, setCellCount] = useState('')
  const [fragmentation, setFragmentation] = useState('')
  const [symmetry, setSymmetry] = useState('')
  const [multinucleation, setMultinucleation] = useState(false)
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: {
          cell_count: parseInt(cellCount),
          fragmentation,
          symmetry,
          multinucleation,
        },
        notes: notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  const isValid = cellCount && fragmentation && symmetry

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isValid) return
        mutation.mutate()
      }}
      className="space-y-5"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cell count *</label>
        <select
          value={cellCount}
          onChange={(e) => setCellCount(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Fragmentation *</legend>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'G1', label: 'G1 (0-10%)' },
            { value: 'G2', label: 'G2 (10-25%)' },
            { value: 'G3', label: 'G3 (25-50%)' },
            { value: 'G4', label: 'G4 (>50%)' },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fragmentation"
                value={value}
                checked={fragmentation === value}
                onChange={() => setFragmentation(value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Symmetry *</legend>
        <div className="flex gap-4">
          {['even', 'uneven'].map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="symmetry"
                value={val}
                checked={symmetry === val}
                onChange={() => setSymmetry(val)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800 capitalize">{val}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={multinucleation}
          onChange={(e) => setMultinucleation(e.target.checked)}
          className="accent-blue-600 w-4 h-4"
        />
        <span className="text-sm text-gray-700">Multinucleation observed</span>
      </label>

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

      <FormActions
        onCancel={onCancel}
        isSubmitting={mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Day 5-6: Blastocyst Grade (Gardner)
// ---------------------------------------------------------------------------

function Day56Form({ embryoId, currentDay, onSuccess, onCancel }: GradeFormProps) {
  const qc = useQueryClient()
  const [expansion, setExpansion] = useState('')
  const [icm, setIcm] = useState('')
  const [te, setTe] = useState('')
  const [notes, setNotes] = useState('')

  const preview =
    expansion && icm && te ? `${expansion}${icm}${te}` : expansion ? `${expansion}--` : '--'

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: { expansion: parseInt(expansion), icm, te },
        notes: notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  const isValid = expansion && icm && te

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isValid) return
        mutation.mutate()
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <span className="text-sm text-blue-700 font-medium">Grade preview:</span>
        <span className="text-2xl font-bold text-blue-800 tracking-widest font-mono">{preview}</span>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Expansion (1-6) *</legend>
        <div className="flex flex-wrap gap-2">
          {['1', '2', '3', '4', '5', '6'].map((val) => (
            <label
              key={val}
              className={`flex items-center gap-1.5 cursor-pointer border rounded-md px-3 py-1.5 hover:bg-gray-50 ${expansion === val ? 'bg-blue-50 border-blue-400' : 'border-gray-200'}`}
            >
              <input
                type="radio"
                name="expansion"
                value={val}
                checked={expansion === val}
                onChange={() => setExpansion(val)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">{val}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">ICM *</legend>
        <div className="flex gap-3">
          {['A', 'B', 'C'].map((val) => (
            <label
              key={val}
              className={`flex items-center gap-2 cursor-pointer border rounded-md px-4 py-2 hover:bg-gray-50 ${icm === val ? 'bg-blue-50 border-blue-400' : 'border-gray-200'}`}
            >
              <input
                type="radio"
                name="icm"
                value={val}
                checked={icm === val}
                onChange={() => setIcm(val)}
                className="accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-800">{val}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">TE (Trophectoderm) *</legend>
        <div className="flex gap-3">
          {['A', 'B', 'C'].map((val) => (
            <label
              key={val}
              className={`flex items-center gap-2 cursor-pointer border rounded-md px-4 py-2 hover:bg-gray-50 ${te === val ? 'bg-blue-50 border-blue-400' : 'border-gray-200'}`}
            >
              <input
                type="radio"
                name="te"
                value={val}
                checked={te === val}
                onChange={() => setTe(val)}
                className="accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-800">{val}</span>
            </label>
          ))}
        </div>
      </fieldset>

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

      <FormActions
        onCancel={onCancel}
        isSubmitting={mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function GradeForm(props: GradeFormProps) {
  const { currentDay } = props
  if (currentDay <= 1) return <Day1Form {...props} />
  if (currentDay <= 3) return <Day23Form {...props} />
  return <Day56Form {...props} />
}
