import pytest

from app.services.constitution_pdf_service import (
    ConstitutionPdfExtractionError,
    ConstitutionPdfValidationError,
    extract_text_from_constitution_pdf,
)
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF


def test_extract_text_from_valid_pdf():
    result = extract_text_from_constitution_pdf(
        file_bytes=SAMPLE_CONSTITUTION_PDF,
        content_type="application/pdf",
        filename="constitution.pdf",
    )

    assert "NSA Constitution Article I" in result.text
    assert result.page_count == 1
    assert result.char_count == len(result.text)
    assert result.filename == "constitution.pdf"


def test_extract_text_rejects_empty_file():
    with pytest.raises(ConstitutionPdfValidationError, match="empty"):
        extract_text_from_constitution_pdf(
            file_bytes=b"",
            content_type="application/pdf",
        )


def test_extract_text_rejects_non_pdf_content_type():
    with pytest.raises(ConstitutionPdfValidationError, match="Unsupported file type"):
        extract_text_from_constitution_pdf(
            file_bytes=SAMPLE_CONSTITUTION_PDF,
            content_type="text/plain",
        )


def test_extract_text_rejects_invalid_pdf_magic_bytes():
    with pytest.raises(ConstitutionPdfValidationError, match="not a valid PDF"):
        extract_text_from_constitution_pdf(
            file_bytes=b"not-a-pdf",
            content_type="application/pdf",
        )


def test_extract_text_rejects_oversized_pdf():
    oversized = SAMPLE_CONSTITUTION_PDF + (b"x" * (20 * 1024 * 1024))

    with pytest.raises(ConstitutionPdfValidationError, match="20 MB"):
        extract_text_from_constitution_pdf(
            file_bytes=oversized,
            content_type="application/pdf",
        )


def test_extract_text_rejects_pdf_with_no_extractable_text():
    from io import BytesIO

    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buffer = BytesIO()
    writer.write(buffer)
    blank_pdf = buffer.getvalue()

    with pytest.raises(ConstitutionPdfExtractionError, match="No extractable text"):
        extract_text_from_constitution_pdf(
            file_bytes=blank_pdf,
            content_type="application/pdf",
        )
