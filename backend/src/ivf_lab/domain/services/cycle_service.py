from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.infrastructure.schemas.cycle import CycleUpdate

VALID_TRANSITIONS: dict[str, list[str]] = {
    "planned": ["active", "cancelled"],
    "active": ["completed", "cancelled"],
}


def transition_status(cycle: Cycle, new_status: str) -> Cycle:
    """Validate and apply a status transition. Raises ValueError on invalid transition."""
    current = cycle.status
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise ValueError(
            f"Invalid status transition from '{current}' to '{new_status}'. "
            f"Allowed transitions: {allowed}"
        )
    cycle.status = new_status
    return cycle


def update_cycle(cycle: Cycle, data: CycleUpdate) -> Cycle:
    """Apply CycleUpdate fields to the cycle, enforcing state machine for status."""
    if data.status is not None:
        transition_status(cycle, data.status)
    if data.retrieval_date is not None:
        cycle.retrieval_date = data.retrieval_date
    if data.insemination_time is not None:
        cycle.insemination_time = data.insemination_time
    if data.transfer_date is not None:
        cycle.transfer_date = data.transfer_date
    if data.outcome is not None:
        cycle.outcome = data.outcome
    if data.assigned_embryologist_id is not None:
        import uuid
        cycle.assigned_embryologist_id = uuid.UUID(data.assigned_embryologist_id)
    if data.notes is not None:
        cycle.notes = data.notes
    return cycle
