"""Seed the database with realistic test data for development."""

import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.checklist import ChecklistTemplate, ChecklistInstance, ChecklistItemResponse
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.models.storage import StorageLocation
from ivf_lab.domain.models.user import User
from ivf_lab.infrastructure.auth.password import hash_password

DEFAULT_PASSWORD = "demo123"


async def seed() -> None:
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        async with session.begin():
            # Clinic
            clinic = Clinic(name="ReproMed IVF Clinic", timezone="Europe/Kyiv")
            session.add(clinic)
            await session.flush()

            # Users
            user_data = [
                ("Dr. Koval", "koval@repromedclinic.com", "senior_embryologist"),
                ("Dr. Shevchenko", "shevchenko@repromedclinic.com", "embryologist"),
                ("Dr. Bondar", "bondar@repromedclinic.com", "lab_manager"),
                ("Admin", "admin@repromedclinic.com", "clinic_admin"),
            ]
            users = []
            pw_hash = hash_password(DEFAULT_PASSWORD)
            for full_name, email, role in user_data:
                u = User(
                    clinic_id=clinic.id,
                    email=email,
                    password_hash=pw_hash,
                    full_name=full_name,
                    role=role,
                )
                session.add(u)
                users.append(u)
            await session.flush()
            embryologist = users[0]

            # Patients
            patients = []
            for i in range(1, 6):
                p = PatientAlias(
                    clinic_id=clinic.id,
                    alias_code=f"PAT-2026-{i:04d}",
                )
                session.add(p)
                patients.append(p)
            await session.flush()

            # Storage hierarchy
            room = StorageLocation(
                clinic_id=clinic.id,
                name="Lab Room 1",
                location_type="room",
                is_managed=False,
            )
            session.add(room)
            await session.flush()

            tank = StorageLocation(
                clinic_id=clinic.id,
                name="Cryo Tank A",
                location_type="cryo_tank",
                is_managed=True,
                parent_id=room.id,
            )
            session.add(tank)
            await session.flush()

            canister = StorageLocation(
                clinic_id=clinic.id,
                name="Canister 1",
                location_type="canister",
                is_managed=True,
                parent_id=tank.id,
                capacity=6,
            )
            session.add(canister)
            await session.flush()

            cane = StorageLocation(
                clinic_id=clinic.id,
                name="Cane 1A",
                location_type="goblet",
                is_managed=True,
                parent_id=canister.id,
                capacity=5,
            )
            session.add(cane)

            cane_2 = StorageLocation(
                clinic_id=clinic.id,
                name="Cane 1B",
                location_type="goblet",
                is_managed=True,
                parent_id=canister.id,
                capacity=5,
            )
            session.add(cane_2)
            await session.flush()

            # Active cycle (Day 5)
            now = datetime.now(timezone.utc)
            insem_time = now - timedelta(hours=114)

            cycle = Cycle(
                clinic_id=clinic.id,
                patient_alias_id=patients[0].id,
                cycle_code="CYC-2026-0001",
                cycle_type="fresh_icsi",
                status="active",
                start_date=date.today() - timedelta(days=14),
                retrieval_date=date.today() - timedelta(days=5),
                insemination_time=insem_time,
                assigned_embryologist_id=embryologist.id,
            )
            session.add(cycle)
            await session.flush()

            # 6 embryos
            embryos = []
            for i in range(1, 7):
                e = Embryo(
                    clinic_id=clinic.id,
                    cycle_id=cycle.id,
                    embryo_code=f"E{i}",
                    source="fresh",
                    disposition="in_culture",
                )
                session.add(e)
                embryos.append(e)
            await session.flush()

            # Day 1 fertilization events
            for e in embryos:
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="fertilization_check",
                        event_day=1,
                        observed_at=insem_time + timedelta(hours=17),
                        time_hpi=17.0,
                        data={"pronuclei": "2pn", "polar_bodies": 2},
                        performed_by=embryologist.id,
                    )
                )

            # Day 3 cleavage grades for first 4
            cell_counts = [8, 8, 6, 4]
            frag_grades = [1, 1, 2, 3]
            for i, e in enumerate(embryos[:4]):
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="cleavage_grade",
                        event_day=3,
                        observed_at=insem_time + timedelta(hours=66),
                        time_hpi=66.0,
                        data={
                            "cell_count": cell_counts[i],
                            "fragmentation": frag_grades[i],
                            "symmetry": "even",
                            "multinucleation": False,
                        },
                        performed_by=embryologist.id,
                    )
                )

            # Day 5 blastocyst grades for first 4 embryos of Cycle 1
            blast_grades = [
                {"expansion": 4, "icm": "A", "te": "B"},  # 4AB — top quality
                {"expansion": 3, "icm": "B", "te": "B"},  # 3BB — good
                {"expansion": 4, "icm": "B", "te": "C"},  # 4BC — fair
                {"expansion": 2, "icm": "C", "te": "C"},  # 2CC — poor
            ]
            for i, e in enumerate(embryos[:4]):
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="blastocyst_grade",
                        event_day=5,
                        observed_at=insem_time + timedelta(hours=114),
                        time_hpi=114.0,
                        data=blast_grades[i],
                        performed_by=embryologist.id,
                    )
                )

            # Cycle 2 — Day 3, fresh_ivf, mixed dispositions
            insem_time_2 = now - timedelta(hours=66)  # Day 3
            cycle_2 = Cycle(
                clinic_id=clinic.id,
                patient_alias_id=patients[1].id,
                cycle_code="CYC-2026-0002",
                cycle_type="fresh_ivf",
                status="active",
                start_date=date.today() - timedelta(days=10),
                retrieval_date=date.today() - timedelta(days=3),
                insemination_time=insem_time_2,
                assigned_embryologist_id=embryologist.id,
            )
            session.add(cycle_2)
            await session.flush()

            # Cycle 2 embryos: 2 in_culture, 1 vitrified, 1 arrested
            c2_dispositions = ["in_culture", "in_culture", "vitrified", "arrested"]
            c2_embryos = []
            for i, disp in enumerate(c2_dispositions, start=1):
                e = Embryo(
                    clinic_id=clinic.id,
                    cycle_id=cycle_2.id,
                    embryo_code=f"E{i}",
                    source="fresh",
                    disposition=disp,
                )
                session.add(e)
                c2_embryos.append(e)
            await session.flush()

            # Day 1 fertilization for Cycle 2
            for e in c2_embryos:
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="fertilization_check",
                        event_day=1,
                        observed_at=insem_time_2 + timedelta(hours=17),
                        time_hpi=17.0,
                        data={"pronuclei": "2pn", "polar_bodies": 2},
                        performed_by=embryologist.id,
                    )
                )

            # Day 3 cleavage for Cycle 2 in_culture embryos
            for e in c2_embryos[:2]:
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="cleavage_grade",
                        event_day=3,
                        observed_at=insem_time_2 + timedelta(hours=66),
                        time_hpi=66.0,
                        data={"cell_count": 8, "fragmentation": 1, "symmetry": "even", "multinucleation": False},
                        performed_by=embryologist.id,
                    )
                )

            # Disposition change events for vitrified + arrested
            session.add(
                EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=c2_embryos[2].id,
                    event_type="disposition_change",
                    event_day=3,
                    observed_at=insem_time_2 + timedelta(hours=68),
                    time_hpi=68.0,
                    data={"from": "in_culture", "to": "vitrified", "reason": "Good quality, patient request"},
                    performed_by=embryologist.id,
                )
            )
            session.add(
                EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=c2_embryos[3].id,
                    event_type="disposition_change",
                    event_day=3,
                    observed_at=insem_time_2 + timedelta(hours=68),
                    time_hpi=68.0,
                    data={"from": "in_culture", "to": "arrested", "reason": "Development arrest at 4-cell"},
                    performed_by=embryologist.id,
                )
            )

            # Cycle 3 — Day 1, frozen_et, transferred + discarded
            insem_time_3 = now - timedelta(hours=20)  # Day 1
            cycle_3 = Cycle(
                clinic_id=clinic.id,
                patient_alias_id=patients[2].id,
                cycle_code="CYC-2026-0003",
                cycle_type="frozen_et",
                status="active",
                start_date=date.today() - timedelta(days=7),
                retrieval_date=date.today() - timedelta(days=1),
                insemination_time=insem_time_3,
                assigned_embryologist_id=users[1].id,  # Dr. Shevchenko
            )
            session.add(cycle_3)
            await session.flush()

            c3_dispositions = ["transferred", "discarded"]
            c3_embryos = []
            for i, disp in enumerate(c3_dispositions, start=1):
                e = Embryo(
                    clinic_id=clinic.id,
                    cycle_id=cycle_3.id,
                    embryo_code=f"E{i}",
                    source="frozen",
                    disposition=disp,
                )
                session.add(e)
                c3_embryos.append(e)
            await session.flush()

            # Fertilization events for Cycle 3
            for e in c3_embryos:
                session.add(
                    EmbryoEvent(
                        clinic_id=clinic.id,
                        embryo_id=e.id,
                        event_type="fertilization_check",
                        event_day=1,
                        observed_at=insem_time_3 + timedelta(hours=17),
                        time_hpi=17.0,
                        data={"pronuclei": "2pn", "polar_bodies": 2},
                        performed_by=users[1].id,
                    )
                )

            # Disposition changes
            session.add(
                EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=c3_embryos[0].id,
                    event_type="disposition_change",
                    event_day=1,
                    observed_at=insem_time_3 + timedelta(hours=19),
                    time_hpi=19.0,
                    data={"from": "in_culture", "to": "transferred", "reason": "Single embryo transfer"},
                    performed_by=users[1].id,
                )
            )
            session.add(
                EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=c3_embryos[1].id,
                    event_type="disposition_change",
                    event_day=1,
                    observed_at=insem_time_3 + timedelta(hours=19),
                    time_hpi=19.0,
                    data={"from": "in_culture", "to": "discarded", "reason": "Abnormal fertilization"},
                    performed_by=users[1].id,
                )
            )

            # Checklist template
            day5_template = ChecklistTemplate(
                clinic_id=clinic.id,
                name="Day 5 Assessment",
                procedure_type="assessment",
                items=[
                    {"order": 1, "label": "Confirm patient alias", "required": True, "field_type": "checkbox"},
                    {"order": 2, "label": "Remove dish from incubator", "required": True, "field_type": "checkbox"},
                    {"order": 3, "label": "Check dish label matches cycle", "required": True, "field_type": "checkbox"},
                    {"order": 4, "label": "Assess each embryo", "required": True, "field_type": "checkbox"},
                    {"order": 5, "label": "Record grades in system", "required": True, "field_type": "checkbox"},
                    {"order": 6, "label": "Decision: transfer/freeze/discard", "required": True, "field_type": "checkbox"},
                    {"order": 7, "label": "Return dish to incubator", "required": True, "field_type": "checkbox"},
                    {"order": 8, "label": "Confirm incubator door closed", "required": True, "field_type": "checkbox"},
                ],
            )
            session.add(day5_template)
            await session.flush()

            # Checklist instances for Cycle 1
            # 1. Completed checklist
            completed_cl = ChecklistInstance(
                clinic_id=clinic.id,
                template_id=day5_template.id,
                cycle_id=cycle.id,
                embryo_id=None,
                status="completed",
                started_at=insem_time + timedelta(hours=110),
                completed_at=insem_time + timedelta(hours=112),
                completed_by=embryologist.id,
            )
            session.add(completed_cl)
            await session.flush()

            for i in range(8):
                session.add(
                    ChecklistItemResponse(
                        clinic_id=clinic.id,
                        checklist_instance_id=completed_cl.id,
                        item_index=i,
                        value={"checked": True},
                        completed_by=embryologist.id,
                        completed_at=insem_time + timedelta(hours=110 + i * 0.25),
                    )
                )

            # 2. In-progress checklist (3 of 8 items done)
            in_progress_cl = ChecklistInstance(
                clinic_id=clinic.id,
                template_id=day5_template.id,
                cycle_id=cycle.id,
                embryo_id=embryos[0].id,
                status="in_progress",
                started_at=insem_time + timedelta(hours=113),
                completed_at=None,
                completed_by=None,
            )
            session.add(in_progress_cl)
            await session.flush()

            for i in range(3):
                session.add(
                    ChecklistItemResponse(
                        clinic_id=clinic.id,
                        checklist_instance_id=in_progress_cl.id,
                        item_index=i,
                        value={"checked": True},
                        completed_by=embryologist.id,
                        completed_at=insem_time + timedelta(hours=113 + i * 0.25),
                    )
                )

            # 3. Pending checklist (no items completed)
            pending_cl = ChecklistInstance(
                clinic_id=clinic.id,
                template_id=day5_template.id,
                cycle_id=cycle.id,
                embryo_id=None,
                status="pending",
                started_at=None,
                completed_at=None,
                completed_by=None,
            )
            session.add(pending_cl)

            # Additional checklist templates
            session.add(
                ChecklistTemplate(
                    clinic_id=clinic.id,
                    name="IVF Preparation",
                    procedure_type="ivf",
                    items=[
                        {"order": 1, "label": "Verify patient identity", "required": True, "field_type": "checkbox"},
                        {"order": 2, "label": "Check culture media temperature", "required": True, "field_type": "checkbox"},
                        {"order": 3, "label": "Confirm dish labeling", "required": True, "field_type": "checkbox"},
                        {"order": 4, "label": "Record sperm parameters", "required": True, "field_type": "text"},
                        {"order": 5, "label": "Number of oocytes inseminated", "required": True, "field_type": "number"},
                    ],
                )
            )
            session.add(
                ChecklistTemplate(
                    clinic_id=clinic.id,
                    name="ICSI Procedure",
                    procedure_type="icsi",
                    items=[
                        {"order": 1, "label": "Verify patient identity", "required": True, "field_type": "checkbox"},
                        {"order": 2, "label": "Prepare injection pipette", "required": True, "field_type": "checkbox"},
                        {"order": 3, "label": "Confirm oocyte maturity", "required": True, "field_type": "checkbox"},
                        {"order": 4, "label": "Record injection time", "required": True, "field_type": "text"},
                        {"order": 5, "label": "Number of oocytes injected", "required": True, "field_type": "number"},
                        {"order": 6, "label": "Return dish to incubator", "required": True, "field_type": "checkbox"},
                    ],
                )
            )

            await session.flush()

    await engine.dispose()
    print(f"Seeded clinic: ReproMed IVF Clinic")
    print(f"Users: {len(user_data)} (password: {DEFAULT_PASSWORD})")
    print(f"Patients: 5 aliases")
    print(f"Cycles: 3 active (Day 5 / Day 3 / Day 1)")
    print(f"Embryos: 12 total (6+4+2) with all dispositions")
    print(f"Storage: 1 room + 1 tank + 1 canister + 2 canes")
    print(f"Checklist templates: 3 (Day 5, IVF Prep, ICSI)")
    print(f"Checklist instances: 3 (completed, in_progress, pending)")


if __name__ == "__main__":
    asyncio.run(seed())
