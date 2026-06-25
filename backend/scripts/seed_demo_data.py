"""Seed demo events and finance entries for local development.

Usage (from backend/):
    python -m scripts.seed_demo_data
"""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member, MemberRole, MemberStatus


def seed_demo_data() -> None:
    db = SessionLocal()

    try:
        treasurer = db.scalar(
            select(Member).where(Member.email == "treasurer@semo.edu"),
        )
        if treasurer is None:
            treasurer = Member(
                full_name="Demo Treasurer",
                email="treasurer@semo.edu",
                student_id="TREAS001",
                major="Administration",
                graduation_year=2028,
                hashed_password=hash_password("DemoPass123!"),
                role=MemberRole.TREASURER,
                status=MemberStatus.APPROVED,
            )
            db.add(treasurer)
            db.flush()

        if db.scalar(select(FinanceEntry.id).limit(1)) is not None:
            print("Finance entries already exist — skipping seed.")
            return

        spring_social = Event(
            title="Spring Social",
            description="Welcome-back social for new and returning members.",
            event_type=EventType.SOCIAL,
            starts_at=datetime(2026, 3, 20, 18, 0, tzinfo=UTC),
            budget=Decimal("200.00"),
            created_by_id=treasurer.id,
        )
        cultural_night = Event(
            title="Dashain Celebration",
            description="Annual cultural night with food and performances.",
            event_type=EventType.CULTURAL,
            starts_at=datetime(2026, 10, 15, 18, 0, tzinfo=UTC),
            budget=Decimal("500.00"),
            created_by_id=treasurer.id,
        )
        db.add_all([spring_social, cultural_night])
        db.flush()

        db.add_all(
            [
                FinanceEntry(
                    entry_type=FinanceEntryType.INCOME,
                    category=FinanceCategory.MEMBERSHIP_DUES,
                    amount=Decimal("120.00"),
                    description="Spring membership dues",
                    created_by_id=treasurer.id,
                    created_at=datetime(2026, 2, 1, 12, 0, tzinfo=UTC),
                ),
                FinanceEntry(
                    entry_type=FinanceEntryType.INCOME,
                    category=FinanceCategory.FUNDRAISING,
                    amount=Decimal("85.00"),
                    description="Bake sale",
                    event_id=spring_social.id,
                    created_by_id=treasurer.id,
                    created_at=datetime(2026, 3, 10, 12, 0, tzinfo=UTC),
                ),
                FinanceEntry(
                    entry_type=FinanceEntryType.EXPENSE,
                    category=FinanceCategory.FOOD_BEVERAGE,
                    amount=Decimal("65.00"),
                    description="Snacks for spring social",
                    event_id=spring_social.id,
                    created_by_id=treasurer.id,
                    created_at=datetime(2026, 3, 18, 12, 0, tzinfo=UTC),
                ),
                FinanceEntry(
                    entry_type=FinanceEntryType.EXPENSE,
                    category=FinanceCategory.VENUE,
                    amount=Decimal("150.00"),
                    description="Room deposit for Dashain",
                    event_id=cultural_night.id,
                    created_by_id=treasurer.id,
                    created_at=datetime(2026, 9, 1, 12, 0, tzinfo=UTC),
                ),
                FinanceEntry(
                    entry_type=FinanceEntryType.EXPENSE,
                    category=FinanceCategory.MARKETING,
                    amount=Decimal("40.00"),
                    description="Flyers and posters",
                    event_id=cultural_night.id,
                    created_by_id=treasurer.id,
                    created_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
                ),
            ],
        )
        db.commit()
        print("Seeded demo events and finance entries.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
