export interface User {
  id: string
  email: string
  full_name: string
  role: string
  clinic_id: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Cycle {
  id: string
  patient_alias_id: string
  cycle_code: string
  cycle_type: string
  status: string
  start_date: string
  retrieval_date: string | null
  insemination_time: string | null
  transfer_date: string | null
  outcome: string | null
  assigned_embryologist_id: string | null
  notes: string | null
  created_at: string
}

export interface EmbryoSummary {
  id: string
  embryo_code: string
  disposition: string
  latest_grade: Record<string, unknown> | null
}

export interface CycleDetail extends Cycle {
  embryos: EmbryoSummary[]
  summary: Record<string, number>
}

export interface Embryo {
  id: string
  cycle_id: string
  embryo_code: string
  source: string
  disposition: string
  storage_location_id: string | null
  created_at: string
}

export interface EmbryoEvent {
  id: string
  embryo_id: string
  event_type: string
  event_day: number
  observed_at: string
  time_hpi: number | null
  data: Record<string, unknown>
  performed_by: string
  notes: string | null
  created_at: string
}

export interface ChecklistTemplate {
  id: string
  name: string
  procedure_type: string
  items: Array<{ order: number; label: string; required: boolean; field_type: string }>
  is_active: boolean
  created_at: string
}

export interface ChecklistInstance {
  id: string
  template_id: string
  cycle_id: string
  embryo_id: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  items: Array<{ item_index: number; value: Record<string, unknown>; completed_by: string; completed_at: string }>
}
