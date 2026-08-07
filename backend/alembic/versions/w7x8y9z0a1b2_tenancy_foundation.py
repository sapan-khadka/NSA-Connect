"""tenancy foundation: university branding, org owner, nullable student_id

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-08-02 15:45:00.000000

Additive multi-tenant foundation (Option A):

1. universities.logo_url + universities.theme (nullable branding hooks)
2. organization_memberships.is_org_owner (system owner flag, not a board seat)
3. users.student_id nullable (campus students still supply one at register)
4. Per-organization exclusive board-seat index on organization_memberships
   (global ix_members_exclusive_position on users remains for dual-write safety)

Seeds is_org_owner=true on the NSA membership of the current president role
holder when one exists.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w7x8y9z0a1b2"
down_revision: Union[str, Sequence[str], None] = "v6w7x8y9z0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "universities",
        sa.Column("logo_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "universities",
        sa.Column("theme", sa.Text(), nullable=True),
    )

    op.add_column(
        "organization_memberships",
        sa.Column(
            "is_org_owner",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.alter_column(
        "users",
        "student_id",
        existing_type=sa.String(length=20),
        nullable=True,
    )

    op.create_index(
        "ix_organization_memberships_exclusive_position",
        "organization_memberships",
        ["organization_id", "position"],
        unique=True,
        postgresql_where=sa.text("position <> 'member'"),
    )

    # Bootstrap: mark NSA president membership as org owner when present.
    op.execute(
        sa.text(
            """
            UPDATE organization_memberships AS om
            SET is_org_owner = true
            FROM organizations AS o
            WHERE om.organization_id = o.id
              AND o.slug = 'nsa'
              AND om.role = 'president'
              AND om.status = 'approved'
            """
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_organization_memberships_exclusive_position",
        table_name="organization_memberships",
        postgresql_where=sa.text("position <> 'member'"),
    )
    op.alter_column(
        "users",
        "student_id",
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.drop_column("organization_memberships", "is_org_owner")
    op.drop_column("universities", "theme")
    op.drop_column("universities", "logo_url")
