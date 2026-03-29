"""Domain enums for all entity types in the IVF Lab Platform."""

import enum


class UserRole(str, enum.Enum):
    EMBRYOLOGIST = "embryologist"
    SENIOR_EMBRYOLOGIST = "senior_embryologist"
    LAB_MANAGER = "lab_manager"
    CLINIC_ADMIN = "clinic_admin"

    def __str__(self) -> str:
        return self.value


class CycleType(str, enum.Enum):
    FRESH_IVF = "fresh_ivf"
    FRESH_ICSI = "fresh_icsi"
    FET = "fet"
    DONOR_OOCYTE = "donor_oocyte"
    DONOR_EMBRYO = "donor_embryo"

    def __str__(self) -> str:
        return self.value


class CycleStatus(str, enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    def __str__(self) -> str:
        return self.value


class CycleOutcome(str, enum.Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    BIOCHEMICAL = "biochemical"
    CLINICAL = "clinical"
    ONGOING = "ongoing"
    LIVE_BIRTH = "live_birth"
    MISCARRIAGE = "miscarriage"

    def __str__(self) -> str:
        return self.value


class EmbryoSource(str, enum.Enum):
    FRESH = "fresh"
    THAWED = "thawed"
    DONATED = "donated"

    def __str__(self) -> str:
        return self.value


class EmbryoDisposition(str, enum.Enum):
    IN_CULTURE = "in_culture"
    VITRIFIED = "vitrified"
    TRANSFERRED = "transferred"
    DISCARDED = "discarded"
    DONATED = "donated"
    BIOPSIED_PENDING = "biopsied_pending"

    def __str__(self) -> str:
        return self.value


class EmbryoEventType(str, enum.Enum):
    FERTILIZATION_CHECK = "fertilization_check"
    CLEAVAGE_GRADE = "cleavage_grade"
    BLASTOCYST_GRADE = "blastocyst_grade"
    DISPOSITION_CHANGE = "disposition_change"
    TRANSFER = "transfer"
    VITRIFICATION = "vitrification"
    WARMING = "warming"
    BIOPSY = "biopsy"
    OBSERVATION = "observation"

    def __str__(self) -> str:
        return self.value


class ProcedureType(str, enum.Enum):
    RETRIEVAL = "retrieval"
    ICSI = "icsi"
    ASSESSMENT = "assessment"
    TRANSFER = "transfer"
    VITRIFICATION = "vitrification"
    WARMING = "warming"

    def __str__(self) -> str:
        return self.value


class ChecklistStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

    def __str__(self) -> str:
        return self.value


class LocationType(str, enum.Enum):
    ROOM = "room"
    INCUBATOR = "incubator"
    CRYO_TANK = "cryo_tank"
    SHELF = "shelf"
    GOBLET = "goblet"
    CANE = "cane"
    POSITION = "position"

    def __str__(self) -> str:
        return self.value


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    VIEW = "view"
    EXPORT = "export"
    LOGIN = "login"

    def __str__(self) -> str:
        return self.value
