"""User-safe API error messages — never expose internals to clients."""

GENERIC_SERVER_ERROR = "Something went wrong. Please try again."
GENERIC_CONFLICT_ERROR = "This action conflicts with existing data."
GENERIC_EXTERNAL_SERVICE_ERROR = (
    "A required service is temporarily unavailable. Please try again later."
)
GENERIC_AI_UNAVAILABLE = (
    "AI assistance is temporarily unavailable. Please try again later."
)
GENERIC_EMBEDDING_UNAVAILABLE = (
    "Search is temporarily unavailable. Please try again later."
)
GENERIC_EMAIL_SEND_FAILED = "Unable to send email right now. Please try again later."
GENERIC_PDF_PROCESSING_ERROR = "Could not process the PDF. Please try again."
