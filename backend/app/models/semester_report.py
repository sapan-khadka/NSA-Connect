from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class ReportRangeType(StrEnum):
    SEMESTER = "semester"
    CUSTOM = "custom"


class SemesterReport(Base):
    __tablename__ = "semester_reports"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    title = Column(String(255), nullable=False)
    range_type = Column(String(16), nullable=False)
    semester = Column(String(32), nullable=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    data_json = Column(Text, nullable=False)
    generated_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    generated_by = relationship("Member")
