import io

from conftest import auth_header, create_board_member, register_member


def _event_payload(**overrides):
    payload = {
        "name": "Attachment Event",
        "starts_at": "2030-10-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Chat attachments",
        "budget": "100.00",
    }
    payload.update(overrides)
    return payload


def _board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_upload_and_attach_discussion_file(client, db_session):
    headers = _board_headers(client, db_session)

    upload = client.post(
        "/api/v1/discussions/attachments/upload",
        files={"file": ("notes.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    assert body["kind"] == "file"
    assert body["file_name"] == "notes.pdf"
    assert body["content_type"] == "application/pdf"
    assert body["url"].startswith("/api/v1/dev-uploads/discussion-attachments/")
    assert body["public_id"]

    event = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=headers,
    ).json()

    message = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={
            "content": "See attached",
            "attachments": [
                {
                    "url": body["url"],
                    "public_id": body["public_id"],
                    "file_name": body["file_name"],
                    "content_type": body["content_type"],
                    "size_bytes": body["size_bytes"],
                    "kind": body["kind"],
                }
            ],
        },
        headers=headers,
    )
    assert message.status_code == 201, message.text
    payload = message.json()
    assert payload["content"] == "See attached"
    assert len(payload["attachments"]) == 1
    assert payload["attachments"][0]["file_name"] == "notes.pdf"
    assert payload["attachments"][0]["url"] == body["url"]

    listed = client.get(
        f"/api/v1/events/{event['id']}/discussion",
        headers=headers,
    )
    assert listed.status_code == 200
    assert listed.json()["messages"][0]["attachments"][0]["kind"] == "file"


def test_attachment_only_message_and_reject_foreign_url(client, db_session):
    headers = _board_headers(client, db_session)

    upload = client.post(
        "/api/v1/discussions/attachments/upload",
        files={"file": ("shot.jpg", io.BytesIO(b"\xff\xd8\xff fake"), "image/jpeg")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    assert body["kind"] == "image"

    board = client.post(
        "/api/v1/board/discussion",
        json={
            "content": "",
            "attachments": [
                {
                    "url": body["url"],
                    "public_id": body["public_id"],
                    "file_name": body["file_name"],
                    "content_type": body["content_type"],
                    "size_bytes": body["size_bytes"],
                    "kind": body["kind"],
                }
            ],
        },
        headers=headers,
    )
    assert board.status_code == 201, board.text
    assert board.json()["content"] == ""
    assert len(board.json()["attachments"]) == 1

    rejected = client.post(
        "/api/v1/board/discussion",
        json={
            "content": "nope",
            "attachments": [
                {
                    "url": "https://evil.example/file.pdf",
                    "public_id": "x",
                    "file_name": "file.pdf",
                    "content_type": "application/pdf",
                    "size_bytes": 12,
                    "kind": "file",
                }
            ],
        },
        headers=headers,
    )
    assert rejected.status_code == 422
    assert "not allowed" in rejected.json()["detail"].lower()


def test_upload_rejects_unsupported_type(client, db_session):
    headers = _board_headers(client, db_session)

    response = client.post(
        "/api/v1/discussions/attachments/upload",
        files={"file": ("notes.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=headers,
    )
    assert response.status_code == 422


def test_list_shared_files_for_board_and_filter_by_kind(client, db_session):
    headers = _board_headers(client, db_session)

    pdf = client.post(
        "/api/v1/discussions/attachments/upload",
        files={"file": ("notes.pdf", io.BytesIO(b"%PDF-1.4 shared"), "application/pdf")},
        headers=headers,
    ).json()
    image = client.post(
        "/api/v1/discussions/attachments/upload",
        files={"file": ("shot.jpg", io.BytesIO(b"\xff\xd8\xff fake"), "image/jpeg")},
        headers=headers,
    ).json()

    for upload in (pdf, image):
        posted = client.post(
            "/api/v1/board/discussion",
            json={
                "content": "",
                "attachments": [
                    {
                        "url": upload["url"],
                        "public_id": upload["public_id"],
                        "file_name": upload["file_name"],
                        "content_type": upload["content_type"],
                        "size_bytes": upload["size_bytes"],
                        "kind": upload["kind"],
                    }
                ],
            },
            headers=headers,
        )
        assert posted.status_code == 201, posted.text

    listed = client.get(
        "/api/v1/discussions/files",
        params={"room_id": "board"},
        headers=headers,
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["total"] >= 2
    names = {row["file_name"] for row in body["files"]}
    assert "notes.pdf" in names
    assert "shot.jpg" in names
    assert all(row["message_id"] > 0 for row in body["files"])
    assert all(row["author_name"] for row in body["files"])

    files_only = client.get(
        "/api/v1/discussions/files",
        params={"room_id": "board", "kind": "file"},
        headers=headers,
    )
    assert files_only.status_code == 200
    assert files_only.json()["total"] >= 1
    assert all(row["kind"] == "file" for row in files_only.json()["files"])
