"""Private Cloudinary delivery for member documents and finance receipts."""

from unittest.mock import patch

from app.integrations.cloudinary_client import (
    DELIVERY_TYPE_AUTHENTICATED,
    is_authenticated_cloudinary_url,
)
from app.services.private_asset_url import resolve_private_asset_url


def test_detects_authenticated_cloudinary_urls():
    assert is_authenticated_cloudinary_url(
        "https://res.cloudinary.com/demo/image/authenticated/v1/folder/doc.pdf"
    )
    assert not is_authenticated_cloudinary_url(
        "https://res.cloudinary.com/demo/image/upload/v1/folder/doc.pdf"
    )
    assert not is_authenticated_cloudinary_url(None)


def test_legacy_public_url_returned_unchanged():
    url = "https://res.cloudinary.com/demo/image/upload/v1/legacy.pdf"
    assert (
        resolve_private_asset_url(
            stored_url=url,
            public_id="legacy",
            resource_type="image",
        )
        == url
    )


def test_authenticated_asset_gets_signed_url(monkeypatch):
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_CLOUD_NAME",
        "demo",
    )
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_API_KEY",
        "key",
    )
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_API_SECRET",
        "secret",
    )
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_SIGNED_URL_TTL_SECONDS",
        900,
    )

    stored = "https://res.cloudinary.com/demo/image/authenticated/v1/folder/doc"
    with patch(
        "app.services.private_asset_url.build_signed_delivery_url",
        return_value="https://res.cloudinary.com/demo/image/authenticated/s--sig--/v1/folder/doc",
    ) as sign:
        resolved = resolve_private_asset_url(
            stored_url=stored,
            public_id="folder/doc",
            resource_type="raw",
        )

    assert "s--sig--" in resolved
    sign.assert_called_once()
    kwargs = sign.call_args.kwargs
    assert kwargs["public_id"] == "folder/doc"
    assert kwargs["resource_type"] == "raw"
    assert kwargs["delivery_type"] == DELIVERY_TYPE_AUTHENTICATED
    assert kwargs["expires_in_seconds"] == 900


def test_force_authenticated_signs_even_when_stored_url_looks_public(monkeypatch):
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_CLOUD_NAME",
        "demo",
    )
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_API_KEY",
        "key",
    )
    monkeypatch.setattr(
        "app.services.private_asset_url.settings.CLOUDINARY_API_SECRET",
        "secret",
    )

    with patch(
        "app.services.private_asset_url.build_signed_delivery_url",
        return_value="https://signed.example/doc",
    ) as sign:
        resolved = resolve_private_asset_url(
            stored_url="https://res.cloudinary.com/demo/image/upload/v1/doc",
            public_id="doc",
            resource_type="image",
            force_authenticated=True,
        )

    assert resolved == "https://signed.example/doc"
    sign.assert_called_once()


def test_build_signed_delivery_url_signs_with_the_real_sdk():
    """Regression: auth_token without a token key raises and receipts won't open."""
    from app.integrations.cloudinary_client import build_signed_delivery_url

    url = build_signed_delivery_url(
        cloud_name="demo",
        api_key="123456789012345",
        api_secret="abcdefghijklmnopqrstuvwxyz12",
        public_id="nsa-connect/finance-receipts/r1",
        resource_type="image",
        delivery_type=DELIVERY_TYPE_AUTHENTICATED,
        expires_in_seconds=3600,
    )

    assert url.startswith("https://res.cloudinary.com/demo/image/authenticated/s--")
    assert url.endswith("/nsa-connect/finance-receipts/r1")
    assert "__cld_token__" not in url


def test_upload_receipt_passes_authenticated_delivery_type():
    from app.integrations.cloudinary_client import upload_receipt

    with patch("app.integrations.cloudinary_client.cloudinary.uploader.upload") as upload:
        upload.return_value = {
            "secure_url": (
                "https://res.cloudinary.com/demo/image/authenticated/v1/r.jpg"
            ),
            "public_id": "folder/r",
            "bytes": 10,
            "format": "jpg",
            "resource_type": "image",
        }
        with patch("app.integrations.cloudinary_client.cloudinary.config"):
            result = upload_receipt(
                cloud_name="demo",
                api_key="k",
                api_secret="s",
                file_bytes=b"jpeg",
                folder="nsa-connect/finance-receipts",
                delivery_type=DELIVERY_TYPE_AUTHENTICATED,
            )

    assert result.delivery_type == DELIVERY_TYPE_AUTHENTICATED
    assert upload.call_args.kwargs["type"] == DELIVERY_TYPE_AUTHENTICATED
