"""NSA Documents library — visibility + board uploads for AI RAG."""

from decimal import Decimal

from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.lib.semester import get_current_semester_slug
from app.models.member import Member, MemberRole, MemberStatus
from app.models.member_dues import MemberDues
from app.models.org_document import OrgDocument, OrgDocumentVisibility
from app.services.ai_chat_tools import execute_chat_tool
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF


def _general_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_board_can_upload_public_document(client, db_session):
    headers = _board_headers(client, db_session)
    response = client.post(
        "/api/v1/org-documents",
        headers=headers,
        data={
            "title": "Membership Guide",
            "description": "How membership works",
            "visibility": "public",
        },
        files={
            "file": ("guide.pdf", SAMPLE_CONSTITUTION_PDF, "application/pdf"),
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Membership Guide"
    assert body["visibility"] == "public"
    assert body["chunk_count"] >= 1


def test_general_member_cannot_upload(client, db_session):
    # First registered user is often org owner; create an extra approved general.
    _board_headers(client, db_session)
    register_member(client, email="regular@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="regular@semo.edu")
    member = db_session.scalar(select(Member).where(Member.email == "regular@semo.edu"))
    assert member is not None
    member.role = MemberRole.GENERAL
    db_session.commit()
    headers = auth_header(client, email="regular@semo.edu")

    response = client.post(
        "/api/v1/org-documents",
        headers=headers,
        data={"title": "Nope", "visibility": "public"},
        files={
            "file": ("x.pdf", SAMPLE_CONSTITUTION_PDF, "application/pdf"),
        },
    )
    assert response.status_code == 403


def test_board_only_docs_hidden_from_general(client, db_session):
    board_headers = _board_headers(client, db_session)
    general_headers = _general_headers(client, db_session)

    board_doc = client.post(
        "/api/v1/org-documents",
        headers=board_headers,
        data={"title": "Board Budget Notes", "visibility": "board"},
        files={
            "file": ("board.pdf", SAMPLE_CONSTITUTION_PDF, "application/pdf"),
        },
    )
    assert board_doc.status_code == 201
    public_doc = client.post(
        "/api/v1/org-documents",
        headers=board_headers,
        data={"title": "Public Policies", "visibility": "public"},
        files={
            "file": ("public.pdf", SAMPLE_CONSTITUTION_PDF, "application/pdf"),
        },
    )
    assert public_doc.status_code == 201

    general_list = client.get("/api/v1/org-documents", headers=general_headers)
    assert general_list.status_code == 200
    titles = {doc["title"] for doc in general_list.json()["documents"]}
    assert "Public Policies" in titles
    assert "Board Budget Notes" not in titles

    board_list = client.get("/api/v1/org-documents", headers=board_headers)
    board_titles = {doc["title"] for doc in board_list.json()["documents"]}
    assert "Board Budget Notes" in board_titles
    assert "Public Policies" in board_titles


def test_search_members_tool_answers_membership(db_session):
    board = create_board_member(db_session)
    apsana = Member(
        full_name="Apsana Sharma",
        email="apsana@semo.edu",
        student_id="44444444",
        major="Biology",
        graduation_year=2027,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(apsana)
    db_session.commit()

    result = execute_chat_tool(
        db=db_session,
        member=board,
        tool_name="search_members",
        tool_input={"query": "Apsana"},
    )
    assert "Apsana Sharma" in result
    assert "approved" in result


def test_member_dues_tool_reports_payment(db_session):
    board = create_board_member(db_session)
    board.role = MemberRole.TREASURER
    db_session.add(board)

    mukesh = Member(
        full_name="Mukesh Thapa",
        email="mukesh@semo.edu",
        student_id="55555555",
        major="CS",
        graduation_year=2026,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(mukesh)
    db_session.flush()

    semester = get_current_semester_slug()
    db_session.add(
        MemberDues(
            member_id=mukesh.id,
            semester=semester,
            amount_owed=Decimal("20.00"),
            amount_paid=Decimal("20.00"),
        )
    )
    db_session.commit()
    db_session.refresh(board)

    result = execute_chat_tool(
        db=db_session,
        member=board,
        tool_name="get_member_dues",
        tool_input={"name": "Mukesh"},
    )
    assert "Mukesh Thapa" in result
    assert "is_paid" in result
    assert "true" in result.lower() or '"status": "paid"' in result.lower()


def test_list_nsa_documents_tool_respects_visibility(db_session):
    board = create_board_member(db_session)
    general = Member(
        full_name="General Member",
        email="gen@semo.edu",
        student_id="66666666",
        major="Art",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(general)
    db_session.flush()

    db_session.add(
        OrgDocument(
            title="Hidden Board Doc",
            visibility=OrgDocumentVisibility.BOARD.value,
            file_name="h.pdf",
            chunk_count=0,
            uploaded_by_id=board.id,
        )
    )
    db_session.add(
        OrgDocument(
            title="Visible Handbook",
            visibility=OrgDocumentVisibility.PUBLIC.value,
            file_name="v.pdf",
            chunk_count=0,
            uploaded_by_id=board.id,
        )
    )
    db_session.commit()

    general_result = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="list_nsa_documents",
        tool_input={},
    )
    assert "Visible Handbook" in general_result
    assert "Hidden Board Doc" not in general_result

    board_result = execute_chat_tool(
        db=db_session,
        member=board,
        tool_name="list_nsa_documents",
        tool_input={},
    )
    assert "Hidden Board Doc" in board_result
