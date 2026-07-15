import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class MemberDocumentType(str, enum.Enum):
    """Member file categories. Values are stable API/storage keys."""

    RESUME = "resume"
    WAIVER = "waiver"  # Waiver / Consent Forms
    # Personal proof-of-payment/records — not Finance reimbursement receipts.
    PERSONAL_RECORDS = "personal_records"
    CERTIFICATE = "certificate"
    PROFILE_MEDIA = "profile_media"
    OTHER = "other"


class MemberDocument(Base):
    __tablename__ = "member_documents"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(
        Integer,
        ForeignKey("members.id"),
        nullable=False,
        index=True,
    )
    file_url = Column(String(2048), nullable=False)
    file_name = Column(String(512), nullable=False)
    document_type = Column(
        Enum(MemberDocumentType, name="member_document_type", native_enum=False),
        nullable=False,
        index=True,
    )
    public_id = Column(String(512), nullable=False)
    resource_type = Column(String(32), nullable=False, server_default="image")
    uploaded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    member = relationship("Member", foreign_keys=[member_id])
    uploaded_by = relationship("Member", foreign_keys=[uploaded_by_id])
