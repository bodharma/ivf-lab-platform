"""Seed the database with realistic test data for development."""

import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.checklist import ChecklistTemplate
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

            # Checklist template
            session.add(
                ChecklistTemplate(
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
            )

            await session.flush()

    await engine.dispose()
    print(f"Seeded clinic: ReproMed IVF Clinic")
    print(f"Users: {len(user_data)} (password: {DEFAULT_PASSWORD})")
    print(f"Patients: 5 aliases")
    print(f"Cycles: 1 active (Day 5, 6 embryos)")
    print(f"Storage: 1 room + 1 cryo tank")
    print(f"Checklist templates: 1 (Day 5 Assessment)")


if __name__ == "__main__":
    asyncio.run(seed())
