import io
from dataclasses import dataclass

from pypdf import PdfReader

ALLOWED_PDF_CONTENT_TYPE = "application/pdf"
PDF_MAGIC_BYTES = b"%PDF"
MAX_CONSTITUTION_PDF_SIZE_BYTES = 20 * 1024 * 1024


class ConstitutionPdfValidationError(Exception):
    pass


class ConstitutionPdfExtractionError(Exception):
    pass


@dataclass(frozen=True)
class ConstitutionPdfExtractResult:
    text: str
    page_count: int
    char_count: int
    filename: str | None = None


def validate_constitution_pdf_file(
    *,
    file_bytes: bytes,
    content_type: str | None,
    filename: str | None = None,
) -> None:
    if len(file_bytes) <= 0:
        raise ConstitutionPdfValidationError("PDF file is empty")

    if len(file_bytes) > MAX_CONSTITUTION_PDF_SIZE_BYTES:
        raise ConstitutionPdfValidationError("PDF file exceeds 20 MB limit")

    if content_type != ALLOWED_PDF_CONTENT_TYPE:
        raise ConstitutionPdfValidationError(
            "Unsupported file type. Only application/pdf is allowed"
        )

    if not file_bytes.startswith(PDF_MAGIC_BYTES):
        raise ConstitutionPdfValidationError("File is not a valid PDF")


def extract_text_from_constitution_pdf(
    *,
    file_bytes: bytes,
    content_type: str | None,
    filename: str | None = None,
) -> ConstitutionPdfExtractResult:
    validate_constitution_pdf_file(
        file_bytes=file_bytes,
        content_type=content_type,
        filename=filename,
    )

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ConstitutionPdfExtractionError("Failed to read PDF file") from exc

    page_count = len(reader.pages)
    if page_count == 0:
        raise ConstitutionPdfExtractionError("PDF contains no pages")

    text_parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)

    text = "\n".join(text_parts).strip()
    if not text:
        raise ConstitutionPdfExtractionError(
            "No extractable text found in PDF"
        )

    return ConstitutionPdfExtractResult(
        text=text,
        page_count=page_count,
        char_count=len(text),
        filename=filename,
    )
