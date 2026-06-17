from app.models.member import Member, MemberRole, MemberStatus


def test_member_table_name():
    assert Member.__tablename__ == "members"


def test_member_role_values():
    assert MemberRole.PRESIDENT.value == "president"
    assert MemberRole.GENERAL.value == "general"


def test_member_status_values():
    assert MemberStatus.PENDING.value == "pending"
    assert MemberStatus.APPROVED.value == "approved"
