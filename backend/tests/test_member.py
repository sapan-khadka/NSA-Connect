from app.models.member import Member, MemberRole, MemberStatus


def test_member_table_name():
    # Phase 1 multi-tenant foundation renamed `members` -> `users`; the ORM
    # class is still named `Member` (also exported as `User`) for now.
    assert Member.__tablename__ == "users"


def test_member_role_values():
    assert MemberRole.PRESIDENT.value == "president"
    assert MemberRole.GENERAL.value == "general"


def test_member_status_values():
    assert MemberStatus.PENDING.value == "pending"
    assert MemberStatus.APPROVED.value == "approved"


def test_role_hierarchy_levels():
    assert MemberRole.GENERAL.level < MemberRole.BOARD.level
    assert MemberRole.BOARD.level < MemberRole.TREASURER.level
    assert MemberRole.TREASURER.level < MemberRole.PRESIDENT.level


def test_role_is_at_least():
    assert MemberRole.PRESIDENT.is_at_least(MemberRole.GENERAL)
    assert MemberRole.BOARD.is_at_least(MemberRole.BOARD)
    assert not MemberRole.GENERAL.is_at_least(MemberRole.BOARD)


def test_member_auth_helpers():
    member = Member(
        full_name="Test User",
        email="test@example.com",
        student_id="12345678",
        major="Computer Science",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.BOARD,
        status=MemberStatus.APPROVED,
    )

    assert member.is_approved is True
    assert member.can_authenticate() is True
    assert member.has_role_at_least(MemberRole.GENERAL) is True
    assert member.has_role_at_least(MemberRole.PRESIDENT) is False

    pending_member = Member(
        full_name="Pending User",
        email="pending@example.com",
        student_id="87654321",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        status=MemberStatus.PENDING,
    )

    assert pending_member.is_pending is True
    assert pending_member.can_authenticate() is False
