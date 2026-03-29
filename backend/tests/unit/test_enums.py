"""Unit tests for domain enums."""

import enum

import pytest

from ivf_lab.domain.models.enums import (
    AuditAction,
    ChecklistStatus,
    CycleOutcome,
    CycleStatus,
    CycleType,
    EmbryoDisposition,
    EmbryoEventType,
    EmbryoSource,
    LocationType,
    ProcedureType,
    UserRole,
)


class TestUserRole:
    def test_is_string_enum(self):
        assert issubclass(UserRole, str)
        assert issubclass(UserRole, enum.Enum)

    def test_all_values(self):
        expected = {"embryologist", "senior_embryologist", "lab_manager", "clinic_admin"}
        assert {r.value for r in UserRole} == expected

    def test_string_equality(self):
        assert UserRole.EMBRYOLOGIST == "embryologist"
        assert UserRole.SENIOR_EMBRYOLOGIST == "senior_embryologist"
        assert UserRole.LAB_MANAGER == "lab_manager"
        assert UserRole.CLINIC_ADMIN == "clinic_admin"

    def test_member_count(self):
        assert len(UserRole) == 4

    def test_lookup_by_value(self):
        assert UserRole("embryologist") is UserRole.EMBRYOLOGIST
        assert UserRole("lab_manager") is UserRole.LAB_MANAGER

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            UserRole("invalid_role")


class TestCycleType:
    def test_is_string_enum(self):
        assert issubclass(CycleType, str)
        assert issubclass(CycleType, enum.Enum)

    def test_all_values(self):
        expected = {"fresh_ivf", "fresh_icsi", "fet", "donor_oocyte", "donor_embryo"}
        assert {c.value for c in CycleType} == expected

    def test_string_equality(self):
        assert CycleType.FRESH_IVF == "fresh_ivf"
        assert CycleType.FRESH_ICSI == "fresh_icsi"
        assert CycleType.FET == "fet"
        assert CycleType.DONOR_OOCYTE == "donor_oocyte"
        assert CycleType.DONOR_EMBRYO == "donor_embryo"

    def test_member_count(self):
        assert len(CycleType) == 5


class TestCycleStatus:
    def test_is_string_enum(self):
        assert issubclass(CycleStatus, str)
        assert issubclass(CycleStatus, enum.Enum)

    def test_all_values(self):
        expected = {"planned", "active", "completed", "cancelled"}
        assert {s.value for s in CycleStatus} == expected

    def test_string_equality(self):
        assert CycleStatus.PLANNED == "planned"
        assert CycleStatus.ACTIVE == "active"
        assert CycleStatus.COMPLETED == "completed"
        assert CycleStatus.CANCELLED == "cancelled"

    def test_member_count(self):
        assert len(CycleStatus) == 4

    def test_lookup_by_value(self):
        assert CycleStatus("active") is CycleStatus.ACTIVE

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            CycleStatus("unknown")

    def test_usable_as_string(self):
        status = CycleStatus.PLANNED
        assert f"Status: {status}" == "Status: planned"


class TestCycleOutcome:
    def test_is_string_enum(self):
        assert issubclass(CycleOutcome, str)
        assert issubclass(CycleOutcome, enum.Enum)

    def test_all_values(self):
        expected = {
            "positive",
            "negative",
            "biochemical",
            "clinical",
            "ongoing",
            "live_birth",
            "miscarriage",
        }
        assert {o.value for o in CycleOutcome} == expected

    def test_string_equality(self):
        assert CycleOutcome.POSITIVE == "positive"
        assert CycleOutcome.LIVE_BIRTH == "live_birth"
        assert CycleOutcome.MISCARRIAGE == "miscarriage"

    def test_member_count(self):
        assert len(CycleOutcome) == 7


class TestEmbryoSource:
    def test_is_string_enum(self):
        assert issubclass(EmbryoSource, str)
        assert issubclass(EmbryoSource, enum.Enum)

    def test_all_values(self):
        expected = {"fresh", "thawed", "donated"}
        assert {s.value for s in EmbryoSource} == expected

    def test_string_equality(self):
        assert EmbryoSource.FRESH == "fresh"
        assert EmbryoSource.THAWED == "thawed"
        assert EmbryoSource.DONATED == "donated"

    def test_member_count(self):
        assert len(EmbryoSource) == 3


class TestEmbryoDisposition:
    def test_is_string_enum(self):
        assert issubclass(EmbryoDisposition, str)
        assert issubclass(EmbryoDisposition, enum.Enum)

    def test_all_values(self):
        expected = {
            "in_culture",
            "vitrified",
            "transferred",
            "discarded",
            "donated",
            "biopsied_pending",
        }
        assert {d.value for d in EmbryoDisposition} == expected

    def test_string_equality(self):
        assert EmbryoDisposition.IN_CULTURE == "in_culture"
        assert EmbryoDisposition.VITRIFIED == "vitrified"
        assert EmbryoDisposition.TRANSFERRED == "transferred"
        assert EmbryoDisposition.DISCARDED == "discarded"
        assert EmbryoDisposition.DONATED == "donated"
        assert EmbryoDisposition.BIOPSIED_PENDING == "biopsied_pending"

    def test_member_count(self):
        assert len(EmbryoDisposition) == 6

    def test_lookup_by_value(self):
        assert EmbryoDisposition("vitrified") is EmbryoDisposition.VITRIFIED

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            EmbryoDisposition("unknown_disposition")

    def test_usable_as_string(self):
        disp = EmbryoDisposition.IN_CULTURE
        assert f"Disposition: {disp}" == "Disposition: in_culture"


class TestEmbryoEventType:
    def test_is_string_enum(self):
        assert issubclass(EmbryoEventType, str)
        assert issubclass(EmbryoEventType, enum.Enum)

    def test_all_values(self):
        expected = {
            "fertilization_check",
            "cleavage_grade",
            "blastocyst_grade",
            "disposition_change",
            "transfer",
            "vitrification",
            "warming",
            "biopsy",
            "observation",
        }
        assert {e.value for e in EmbryoEventType} == expected

    def test_string_equality(self):
        assert EmbryoEventType.FERTILIZATION_CHECK == "fertilization_check"
        assert EmbryoEventType.CLEAVAGE_GRADE == "cleavage_grade"
        assert EmbryoEventType.BLASTOCYST_GRADE == "blastocyst_grade"
        assert EmbryoEventType.DISPOSITION_CHANGE == "disposition_change"
        assert EmbryoEventType.TRANSFER == "transfer"
        assert EmbryoEventType.VITRIFICATION == "vitrification"
        assert EmbryoEventType.WARMING == "warming"
        assert EmbryoEventType.BIOPSY == "biopsy"
        assert EmbryoEventType.OBSERVATION == "observation"

    def test_member_count(self):
        assert len(EmbryoEventType) == 9

    def test_lookup_by_value(self):
        assert EmbryoEventType("biopsy") is EmbryoEventType.BIOPSY
        assert EmbryoEventType("warming") is EmbryoEventType.WARMING

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            EmbryoEventType("unknown_event")

    def test_usable_as_string(self):
        event = EmbryoEventType.FERTILIZATION_CHECK
        assert f"Event: {event}" == "Event: fertilization_check"


class TestProcedureType:
    def test_is_string_enum(self):
        assert issubclass(ProcedureType, str)
        assert issubclass(ProcedureType, enum.Enum)

    def test_all_values(self):
        expected = {"retrieval", "icsi", "assessment", "transfer", "vitrification", "warming"}
        assert {p.value for p in ProcedureType} == expected

    def test_string_equality(self):
        assert ProcedureType.RETRIEVAL == "retrieval"
        assert ProcedureType.ICSI == "icsi"
        assert ProcedureType.ASSESSMENT == "assessment"
        assert ProcedureType.TRANSFER == "transfer"
        assert ProcedureType.VITRIFICATION == "vitrification"
        assert ProcedureType.WARMING == "warming"

    def test_member_count(self):
        assert len(ProcedureType) == 6


class TestChecklistStatus:
    def test_is_string_enum(self):
        assert issubclass(ChecklistStatus, str)
        assert issubclass(ChecklistStatus, enum.Enum)

    def test_all_values(self):
        expected = {"pending", "in_progress", "completed"}
        assert {s.value for s in ChecklistStatus} == expected

    def test_string_equality(self):
        assert ChecklistStatus.PENDING == "pending"
        assert ChecklistStatus.IN_PROGRESS == "in_progress"
        assert ChecklistStatus.COMPLETED == "completed"

    def test_member_count(self):
        assert len(ChecklistStatus) == 3


class TestLocationType:
    def test_is_string_enum(self):
        assert issubclass(LocationType, str)
        assert issubclass(LocationType, enum.Enum)

    def test_all_values(self):
        expected = {"room", "incubator", "cryo_tank", "shelf", "goblet", "cane", "position"}
        assert {lt.value for lt in LocationType} == expected

    def test_string_equality(self):
        assert LocationType.ROOM == "room"
        assert LocationType.INCUBATOR == "incubator"
        assert LocationType.CRYO_TANK == "cryo_tank"
        assert LocationType.SHELF == "shelf"
        assert LocationType.GOBLET == "goblet"
        assert LocationType.CANE == "cane"
        assert LocationType.POSITION == "position"

    def test_member_count(self):
        assert len(LocationType) == 7


class TestAuditAction:
    def test_is_string_enum(self):
        assert issubclass(AuditAction, str)
        assert issubclass(AuditAction, enum.Enum)

    def test_all_values(self):
        expected = {"create", "update", "delete", "view", "export", "login"}
        assert {a.value for a in AuditAction} == expected

    def test_string_equality(self):
        assert AuditAction.CREATE == "create"
        assert AuditAction.UPDATE == "update"
        assert AuditAction.DELETE == "delete"
        assert AuditAction.VIEW == "view"
        assert AuditAction.EXPORT == "export"
        assert AuditAction.LOGIN == "login"

    def test_member_count(self):
        assert len(AuditAction) == 6
