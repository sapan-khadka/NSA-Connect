import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.member import Member
from app.models.member_document import MemberDocument, MemberDocumentType

MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
)


@pytest.fixture
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def president_headers(client, db_session):
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def general_member(client, db_session):
    register_member(client, email="general@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="general@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "general@semo.edu"))


@pytest.fixture
def general_headers(client, general_member):
    return auth_header(client, email="general@semo.edu")


@pytest.fixture
def other_member(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="other@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "other@semo.edu"))


@pytest.fixture
def other_headers(client, other_member):
    return auth_header(client, email="other@semo.edu")


def test_board_can_list_upload_and_delete_member_documents(
    client,
    db_session,
    board_headers,
    general_member,
    block_external_integrations,
):
    empty = client.get(
        f"/api/v1/members/{general_member.id}/documents",
        headers=board_headers,
    )
    assert empty.status_code == 200
    assert empty.json()["documents"] == []
    assert empty.json()["total"] == 0

    upload = client.post(
        f"/api/v1/members/{general_member.id}/documents",
        headers=board_headers,
        data={"document_type": "resume"},
        files={"file": ("resume.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["member_id"] == general_member.id
    assert body["file_name"] == "resume.pdf"
    assert body["document_type"] == "resume"
    assert body["file_url"].startswith("https://res.cloudinary.com/")
    assert body["uploaded_by_name"]
    assert body["can_delete"] is True
    assert body["can_replace"] is True

    upload_kwargs = block_external_integrations[
        "cloudinary_upload_receipt"
    ].call_args.kwargs
    assert upload_kwargs["folder"] == "nsa-connect/member-documents"

    listed = client.get(
        f"/api/v1/members/{general_member.id}/documents",
        headers=board_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["documents"][0]["id"] == body["id"]

    deleted = client.delete(
        f"/api/v1/members/{general_member.id}/documents/{body['id']}",
        headers=board_headers,
    )
    assert deleted.status_code == 204
    assert (
        db_session.scalar(
            select(MemberDocument).where(MemberDocument.id == body["id"]),
        )
        is None
    )


def test_member_can_manage_own_documents_but_not_others(
    client,
    db_session,
    general_member,
    general_headers,
    other_member,
    other_headers,
    block_external_integrations,
):
    own_upload = client.post(
        f"/api/v1/members/{general_member.id}/documents",
        headers=general_headers,
        data={"document_type": "personal_records"},
        files={"file": ("dues.pdf", b"%PDF-1.4 dues", "application/pdf")},
    )
    assert own_upload.status_code == 201
    own_id = own_upload.json()["id"]
    assert own_upload.json()["document_type"] == "personal_records"

    own_list = client.get(
        f"/api/v1/members/{general_member.id}/documents",
        headers=general_headers,
    )
    assert own_list.status_code == 200
    assert own_list.json()["total"] == 1
    assert own_list.json()["documents"][0]["id"] == own_id

    # Cannot list/upload/delete another member's documents (API-level).
    assert (
        client.get(
            f"/api/v1/members/{other_member.id}/documents",
            headers=general_headers,
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/members/{other_member.id}/documents",
            headers=general_headers,
            data={"document_type": "other"},
            files={"file": ("note.jpg", MINIMAL_JPEG, "image/jpeg")},
        ).status_code
        == 403
    )

    other_doc = MemberDocument(
        member_id=other_member.id,
        uploaded_by_id=other_member.id,
        file_url="https://res.cloudinary.com/test/other.pdf",
        file_name="other.pdf",
        document_type=MemberDocumentType.OTHER,
        public_id="nsa-connect/member-documents/other",
        resource_type="raw",
    )
    db_session.add(other_doc)
    db_session.commit()
    db_session.refresh(other_doc)

    # Wrong member path → 403 (not a leak of that document's existence via success).
    assert (
        client.delete(
            f"/api/v1/members/{other_member.id}/documents/{other_doc.id}",
            headers=general_headers,
        ).status_code
        == 403
    )
    # Own path with someone else's document id → 404 (ownership filter).
    assert (
        client.delete(
            f"/api/v1/members/{general_member.id}/documents/{other_doc.id}",
            headers=general_headers,
        ).status_code
        == 404
    )
    assert (
        client.put(
            f"/api/v1/members/{other_member.id}/documents/{other_doc.id}",
            headers=general_headers,
            data={"document_type": "other"},
            files={"file": ("hijack.pdf", b"%PDF-1.4 x", "application/pdf")},
        ).status_code
        == 403
    )

    replaced = client.put(
        f"/api/v1/members/{general_member.id}/documents/{own_id}",
        headers=general_headers,
        data={"document_type": "profile_media", "file_name": "headshot.jpg"},
        files={"file": ("headshot.jpg", MINIMAL_JPEG, "image/jpeg")},
    )
    assert replaced.status_code == 200
    assert replaced.json()["id"] == own_id
    assert replaced.json()["document_type"] == "profile_media"
    assert replaced.json()["file_name"] == "headshot.jpg"

    deleted = client.delete(
        f"/api/v1/members/{general_member.id}/documents/{own_id}",
        headers=general_headers,
    )
    assert deleted.status_code == 204


def test_president_can_upload_with_custom_file_name(
    client,
    president_headers,
    general_member,
    block_external_integrations,
):
    response = client.post(
        f"/api/v1/members/{general_member.id}/documents",
        headers=president_headers,
        data={
            "document_type": MemberDocumentType.WAIVER.value,
            "file_name": "Liability Waiver 2026.pdf",
        },
        files={"file": ("scan.pdf", b"%PDF-1.4 liability", "application/pdf")},
    )
    assert response.status_code == 201
    assert response.json()["file_name"] == "Liability Waiver 2026.pdf"
    assert response.json()["document_type"] == "waiver"
    block_external_integrations["cloudinary_upload_receipt"].assert_called_once()


def test_upload_rejects_unsupported_type(client, board_headers, general_member):
    response = client.post(
        f"/api/v1/members/{general_member.id}/documents",
        headers=board_headers,
        data={"document_type": "other"},
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )
    assert response.status_code == 422
    assert "Unsupported receipt file type" in response.json()["detail"]


def test_documents_404_for_unknown_member(client, board_headers):
    response = client.get(
        "/api/v1/members/999999/documents",
        headers=board_headers,
    )
    assert response.status_code == 404
