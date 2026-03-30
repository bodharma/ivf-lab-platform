# Create Cycle & Add Embryos — Design Spec

## Goal

Add UI for creating cycles (from Dashboard) and batch-adding embryos (from CycleView).

## Create Cycle

- "New Cycle" button in Dashboard header
- Modal dialog with fields:
  - Patient alias: dropdown of existing patients + "New Patient" button (auto-generates next PAT-2026-XXXX)
  - Cycle code: text input
  - Cycle type: select (fresh_icsi, fresh_ivf, frozen_et)
  - Start date: date input, defaults to today
- API: `POST /patients` (alias_code) + `POST /cycles` (patient_alias_id, cycle_code, cycle_type, start_date)
- On success: redirect to new CycleView

## Add Embryos (Batch)

- "Add Embryos" button in CycleView Embryo section header
- Modal dialog with fields:
  - Number of embryos: number input (1-20)
  - Source: select (fresh/frozen)
  - Preview: list of generated codes (E1, E2... E{n})
- API: sequential `POST /cycles/{id}/embryos` for each embryo ({embryo_code, source})
- On success: invalidate cycle query, embryos appear in table

## Patterns

- Modal dialogs (same as EmbryoDetail actions)
- TanStack Query mutations + invalidateQueries
- Tailwind styling matching existing forms
- New hooks: `usePatients`, `useCreatePatient`, `useCreateCycle`, `useCreateEmbryo`
