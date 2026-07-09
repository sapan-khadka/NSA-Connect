from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class PrepTaskGroup(Base):
    """Catalog of prep groups; group_name drives available checklist selections."""

    __tablename__ = "prep_task_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(255), nullable=False, unique=True)
    items = relationship(
        "PrepTaskGroupItem",
        back_populates="group",
        order_by="PrepTaskGroupItem.sort_order",
        cascade="all, delete-orphan",
    )


class PrepTaskGroupItem(Base):
    """Template checklist row for a group — selecting group_name seeds these items."""

    __tablename__ = "prep_task_group_items"
    __table_args__ = (
        UniqueConstraint(
            "group_id", "sort_order", name="uq_prep_task_group_items_order"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("prep_task_groups.id"), nullable=False)
    label = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    group = relationship("PrepTaskGroup", back_populates="items")
