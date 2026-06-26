from datetime import UTC, datetime

from app.models.volunteer import VolunteerSignup, VolunteerSlot


def test_volunteer_slot_table_name():
    assert VolunteerSlot.__tablename__ == "volunteer_slots"


def test_volunteer_signup_table_name():
    assert VolunteerSignup.__tablename__ == "volunteer_signups"


def test_volunteer_slot_capacity_helpers():
    slot = VolunteerSlot(
        event_id=1,
        title="Setup crew",
        description="Help set up before the event.",
        capacity=2,
        created_at=datetime.now(UTC),
    )
    slot.signups = [
        VolunteerSignup(
            slot_id=1,
            member_id=10,
            created_at=datetime.now(UTC),
        ),
    ]

    assert slot.signup_count == 1
    assert slot.spots_remaining == 1
    assert slot.is_full is False

    slot.signups.append(
        VolunteerSignup(
            slot_id=1,
            member_id=11,
            created_at=datetime.now(UTC),
        ),
    )

    assert slot.signup_count == 2
    assert slot.spots_remaining == 0
    assert slot.is_full is True
