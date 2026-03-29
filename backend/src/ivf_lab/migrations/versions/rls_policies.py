"""Enable RLS on all tenant-scoped tables

Revision ID: rls_policies
Revises: 7b75fcd301de
Create Date: 2026-03-29
"""
from typing import Sequence, Union

from alembic import op

revision: str = "rls_policies"
down_revision: Union[str, None] = "7b75fcd301de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_TABLES = [
    "users",
    "patient_aliases",
    "cycles",
    "embryos",
    "embryo_events",
    "checklist_templates",
    "checklist_instances",
    "checklist_item_responses",
    "storage_locations",
    "audit_logs",
]


def upgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY clinic_isolation ON {table} "
            f"USING (clinic_id = current_setting('app.current_clinic_id')::uuid)"
        )
        op.execute(
            f"CREATE POLICY clinic_isolation_insert ON {table} "
            f"FOR INSERT "
            f"WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid)"
        )


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
