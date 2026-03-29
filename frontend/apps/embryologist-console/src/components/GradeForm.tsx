import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const day1Schema = z.object({
  pronuclei: z.enum(['2pn', '1pn', '0pn', '3pn']),
  polar_bodies: z.number().int().min(0).max(4).optional(),
  notes: z.string().optional(),
})

const day23Schema = z.object({
  cell_count: z.number().int().min(1).max(16),
  fragmentation: z.enum(['G1', 'G2', 'G3', 'G4']),
  symmetry: z.enum(['even', 'uneven']),
  multinucleation: z.boolean().optional(),
  notes: z.string().optional(),
})

const day56Schema = z.object({
  expansion: z.number().int().min(1).max(6),
  icm: z.enum(['A', 'B', 'C']),
  te: z.enum(['A', 'B', 'C']),
  notes: z.string().optional(),
})

type Day1Values = z.infer<typeof day1Schema>
type Day23Values = z.infer<typeof day23Schema>
type Day56Values = z.infer<typeof day56Schema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEventType(currentDay: number): string {
  if (currentDay <= 1) return 'fertilization_check'
  if (currentDay <= 3) return 'cleavage_grade'
  return 'blastocyst_grade'
}

function getSchema(currentDay: number) {
  if (currentDay <= 1) return day1Schema
  if (currentDay <= 3) return day23Schema
  return day56Schema
}

// ---------------------------------------------------------------------------
// Sub-forms
// ---------------------------------------------------------------------------

function Day1Form({
  embryoId,
  currentDay,
  onSuccess,
  onCancel,
}: GradeFormProps) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Day1Values>({ resolver: zodResolver(day1Schema) })

  const mutation = useMutation({
    mutationFn: (data: Day1Values) =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: { pronuclei: data.pronuclei, polar_bodies: data.polar_bodies },
        notes: data.notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((values) => mutation.mutate(values))

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {/* Pronuclei */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Pronuclei *</legend>
        <div className="flex flex-wrap gap-3">
          {(['2pn', '1pn', '0pn', '3pn'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value={val} {...register('pronuclei')} className="accent-blue-600" />
              <span className="text-sm text-gray-800">{val.toUpperCase()}</span>
            </label>
          ))}
        </div>
        {errors.pronuclei && (
          <p className="text-xs text-red-600 mt-1">{errors.pronuclei.message}</p>
        )}
      </fieldset>

      {/* Polar bodies */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Polar bodies
        </label>
        <input
          type="number"
          min={0}
          max={4}
          {...register('polar_bodies', { valueAsNumber: true })}
          className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          {...register('notes')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Optional notes…"
        />
      </div>

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting || mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

function Day23Form({
  embryoId,
  currentDay,
  onSuccess,
  onCancel,
}: GradeFormProps) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Day23Values>({ resolver: zodResolver(day23Schema) })

  const mutation = useMutation({
    mutationFn: (data: Day23Values) =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: {
          cell_count: data.cell_count,
          fragmentation: data.fragmentation,
          symmetry: data.symmetry,
          multinucleation: data.multinucleation ?? false,
        },
        notes: data.notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((values) => mutation.mutate(values))

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {/* Cell count */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cell count *
        </label>
        <select
          {...register('cell_count', { valueAsNumber: true })}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select…</option>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {errors.cell_count && (
          <p className="text-xs text-red-600 mt-1">{errors.cell_count.message}</p>
        )}
      </div>

      {/* Fragmentation */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Fragmentation *
        </legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              { value: 'G1', label: 'G1 (0–10%)' },
              { value: 'G2', label: 'G2 (10–25%)' },
              { value: 'G3', label: 'G3 (25–50%)' },
              { value: 'G4', label: 'G4 (>50%)' },
            ] as const
          ).map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={value}
                {...register('fragmentation')}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800">{label}</span>
            </label>
          ))}
        </div>
        {errors.fragmentation && (
          <p className="text-xs text-red-600 mt-1">{errors.fragmentation.message}</p>
        )}
      </fieldset>

      {/* Symmetry */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Symmetry *</legend>
        <div className="flex gap-4">
          {(['even', 'uneven'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={val}
                {...register('symmetry')}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800 capitalize">{val}</span>
            </label>
          ))}
        </div>
        {errors.symmetry && (
          <p className="text-xs text-red-600 mt-1">{errors.symmetry.message}</p>
        )}
      </fieldset>

      {/* Multinucleation */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" {...register('multinucleation')} className="accent-blue-600 w-4 h-4" />
        <span className="text-sm text-gray-700">Multinucleation observed</span>
      </label>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          {...register('notes')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Optional notes…"
        />
      </div>

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting || mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

function Day56Form({
  embryoId,
  currentDay,
  onSuccess,
  onCancel,
}: GradeFormProps) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Day56Values>({ resolver: zodResolver(day56Schema) })

  const expansion = watch('expansion')
  const icm = watch('icm')
  const te = watch('te')
  const preview =
    expansion && icm && te ? `${expansion}${icm}${te}` : expansion ? `${expansion}--` : '--'

  const mutation = useMutation({
    mutationFn: (data: Day56Values) =>
      api.post(`/embryos/${embryoId}/events`, {
        event_type: getEventType(currentDay),
        event_day: currentDay,
        observed_at: new Date().toISOString(),
        data: { expansion: data.expansion, icm: data.icm, te: data.te },
        notes: data.notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['embryos', embryoId] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((values) => mutation.mutate(values))

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {/* Live grade preview */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <span className="text-sm text-blue-700 font-medium">Grade preview:</span>
        <span className="text-2xl font-bold text-blue-800 tracking-widest font-mono">
          {preview}
        </span>
      </div>

      {/* Expansion */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Expansion (1–6) *
        </legend>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5, 6] as const).map((val) => (
            <label
              key={val}
              className="flex items-center gap-1.5 cursor-pointer border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400"
            >
              <input
                type="radio"
                value={val}
                {...register('expansion', { valueAsNumber: true })}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">{val}</span>
            </label>
          ))}
        </div>
        {errors.expansion && (
          <p className="text-xs text-red-600 mt-1">{errors.expansion.message}</p>
        )}
      </fieldset>

      {/* ICM */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">ICM *</legend>
        <div className="flex gap-3">
          {(['A', 'B', 'C'] as const).map((val) => (
            <label
              key={val}
              className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-4 py-2 hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400"
            >
              <input
                type="radio"
                value={val}
                {...register('icm')}
                className="accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-800">{val}</span>
            </label>
          ))}
        </div>
        {errors.icm && (
          <p className="text-xs text-red-600 mt-1">{errors.icm.message}</p>
        )}
      </fieldset>

      {/* TE */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">TE (Trophectoderm) *</legend>
        <div className="flex gap-3">
          {(['A', 'B', 'C'] as const).map((val) => (
            <label
              key={val}
              className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-md px-4 py-2 hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400"
            >
              <input
                type="radio"
                value={val}
                {...register('te')}
                className="accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-800">{val}</span>
            </label>
          ))}
        </div>
        {errors.te && (
          <p className="text-xs text-red-600 mt-1">{errors.te.message}</p>
        )}
      </fieldset>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          {...register('notes')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Optional notes…"
        />
      </div>

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting || mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Shared action buttons
// ---------------------------------------------------------------------------

interface FormActionsProps {
  onCancel: () => void
  isSubmitting: boolean
  error: string | null
}

function FormActions({ onCancel, isSubmitting, error }: FormActionsProps) {
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
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving…' : 'Save grade'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface GradeFormProps {
  embryoId: string
  currentDay: number
  onSuccess: () => void
  onCancel: () => void
}

export default function GradeForm(props: GradeFormProps) {
  // Ensure the schema is referenced (keeps tree-shaking from removing it)
  void getSchema(props.currentDay)

  const { currentDay } = props

  if (currentDay <= 1) return <Day1Form {...props} />
  if (currentDay <= 3) return <Day23Form {...props} />
  return <Day56Form {...props} />
}
