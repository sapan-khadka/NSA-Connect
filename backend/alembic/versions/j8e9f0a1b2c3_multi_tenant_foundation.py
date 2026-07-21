"""Phase 1 multi-tenant foundation: universities, organizations, org memberships

Revision ID: j8e9f0a1b2c3
Revises: i7d8e9f0a1b2
Create Date: 2026-07-20 12:40:00.000000

Introduces the multi-tenant scaffolding while keeping the app fully
single-tenant in behavior:

1. Creates `universities` and `organizations` tables.
2. Seeds one row in each (SEMO / NSA, both id=1) — the implicit tenant every
   existing row belongs to.
3. Renames `members` -> `users` (PostgreSQL keeps existing FK/index/constraint
   definitions pointed at the renamed table automatically; only the table's
   own name changes, so no application FKs needed manual repair here beyond
   what the model layer already does).
4. Adds `users.university_id` (nullable, backfilled to 1) and
   `users.platform_role` (plain string column, default "student" — kept as a
   non-native-enum VARCHAR specifically to avoid a `CREATE TYPE` + associated
   downgrade complexity for a brand-new enum with no existing data).
5. Creates `organization_memberships`, one row per existing user, copying
   their current role/status/position/custom_board_position_id into the
   default organization (id=1). This is the org-scoped mirror of those
   fields; `users` keeps its own copies for Phase 1 backward compatibility.
6. Adds a nullable `organization_id` FK to every Phase-1 "P0" tenant-scoped
   table, backfills it to 1, then tightens it to NOT NULL and indexes it.
7. Re-scopes two previously-global unique constraints to be per-organization:
   `semester_dues_settings.semester` and
   `custom_board_positions.name_normalized`.

Note: `users.position`'s exclusive-position partial unique index
(`ix_members_exclusive_position`, from c3d4e5f6a7b8) is intentionally left
as a single *global* constraint in Phase 1 — it is not yet re-scoped to be
per-organization. Every current row belongs to org 1, so behavior is
unchanged today; a follow-up migration should move that exclusivity rule
onto `organization_memberships` (per organization) once board-position
enforcement moves off of the legacy `users.position` column.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "j8e9f0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "i7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_UNIVERSITY_SLUG = "semo"
DEFAULT_UNIVERSITY_NAME = "Southeast Missouri State University"
DEFAULT_UNIVERSITY_EMAIL_DOMAIN = "semo.edu"
DEFAULT_ORGANIZATION_SLUG = "nsa"
DEFAULT_ORGANIZATION_NAME = "Nepalese Student Association"

# Tables that get a tenant-scoping `organization_id` column in this migration.
P0_TENANT_TABLES = [
    "events",
    "finance_entries",
    "announcements",
    "discussion_rooms",
    "semester_dues_settings",
    "member_dues",
    "prep_task_groups",
    "custom_board_positions",
    "constitutional_chunks",
    "semester_reports",
    "event_suggestions",
    "inbox_notifications",
]

memberrole = postgresql.ENUM(
    "president",
    "treasurer",
    "board",
    "general",
    name="memberrole",
    create_type=False,
)
memberstatus = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="memberstatus",
    create_type=False,
)
memberposition = postgresql.ENUM(
    "president",
    "vice_president",
    "secretary",
    "treasurer",
    "event_manager",
    "public_relations_officer",
    "new_student_representative",
    "member",
    name="memberposition",
    create_type=False,
)


def _fk_name(table: str) -> str:
    return f"fk_{table}_organization_id"


def _ix_name(table: str) -> str:
    return f"ix_{table}_organization_id"


def _find_unique_constraint_name(
    bind, table_name: str, columns: list[str]
) -> str | None:
    inspector = sa.inspect(bind)
    for constraint in inspector.get_unique_constraints(table_name):
        if set(constraint["column_names"]) == set(columns):
            return constraint["name"]
    return None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. universities + organizations
    op.create_table(
        "universities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("email_domain", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_universities_slug"),
    )
    op.create_index(
        op.f("ix_universities_id"), "universities", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_universities_slug"), "universities", ["slug"], unique=True
    )

    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("university_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            ondelete="CASCADE",
            name="fk_organizations_university_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
    )
    op.create_index(
        op.f("ix_organizations_id"), "organizations", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_organizations_slug"), "organizations", ["slug"], unique=True
    )
    op.create_index(
        op.f("ix_organizations_university_id"),
        "organizations",
        ["university_id"],
        unique=False,
    )

    # 2. Seed SEMO (id=1) + NSA (id=1), then re-sync sequences.
    op.execute(
        sa.text(
            """
            INSERT INTO universities
                (id, name, slug, email_domain, created_at, updated_at)
            VALUES (1, :name, :slug, :email_domain, now(), now())
            """
        ).bindparams(
            name=DEFAULT_UNIVERSITY_NAME,
            slug=DEFAULT_UNIVERSITY_SLUG,
            email_domain=DEFAULT_UNIVERSITY_EMAIL_DOMAIN,
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO organizations
                (id, university_id, name, slug, status, created_at, updated_at)
            VALUES (1, 1, :name, :slug, 'active', now(), now())
            """
        ).bindparams(name=DEFAULT_ORGANIZATION_NAME, slug=DEFAULT_ORGANIZATION_SLUG)
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('universities', 'id'), "
        "(SELECT MAX(id) FROM universities))"
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('organizations', 'id'), "
        "(SELECT MAX(id) FROM organizations))"
    )

    # 3. members -> users. PostgreSQL keeps existing indexes/constraints/FKs
    # intact under their original (members-prefixed) names.
    op.rename_table("members", "users")

    # 4. users.university_id + users.platform_role
    op.add_column(
        "users",
        sa.Column("university_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_university_id",
        "users",
        "universities",
        ["university_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_users_university_id"), "users", ["university_id"], unique=False
    )
    op.execute("UPDATE users SET university_id = 1")

    op.add_column(
        "users",
        sa.Column(
            "platform_role",
            sa.String(length=32),
            nullable=False,
            server_default="student",
        ),
    )

    # 5. organization_memberships, backfilled from existing users.
    op.create_table(
        "organization_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("role", memberrole, nullable=False, server_default="general"),
        sa.Column("status", memberstatus, nullable=False, server_default="pending"),
        sa.Column(
            "position", memberposition, nullable=False, server_default="member"
        ),
        sa.Column("custom_board_position_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_organization_memberships_user_id",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
            name="fk_organization_memberships_organization_id",
        ),
        sa.ForeignKeyConstraint(
            ["custom_board_position_id"],
            ["custom_board_positions.id"],
            ondelete="SET NULL",
            name="fk_organization_memberships_custom_board_position_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "organization_id",
            name="uq_organization_memberships_user_org",
        ),
    )
    op.create_index(
        op.f("ix_organization_memberships_id"),
        "organization_memberships",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_memberships_user_id"),
        "organization_memberships",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_memberships_organization_id"),
        "organization_memberships",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_memberships_custom_board_position_id"),
        "organization_memberships",
        ["custom_board_position_id"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO organization_memberships
            (user_id, organization_id, role, status, position,
             custom_board_position_id, created_at, updated_at)
        SELECT id, 1, role, status, position, custom_board_position_id, now(), now()
        FROM users
        """
    )

    # 6. organization_id on every Phase-1 tenant-scoped table.
    for table in P0_TENANT_TABLES:
        op.add_column(
            table,
            sa.Column("organization_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            _fk_name(table),
            table,
            "organizations",
            ["organization_id"],
            ["id"],
        )
        op.execute(f"UPDATE {table} SET organization_id = 1")
        op.alter_column(table, "organization_id", nullable=False)
        op.create_index(
            _ix_name(table), table, ["organization_id"], unique=False
        )

    # 7. Re-scope previously-global unique constraints to be per-organization.
    semester_dues_uq = _find_unique_constraint_name(
        bind, "semester_dues_settings", ["semester"]
    )
    if semester_dues_uq:
        op.drop_constraint(
            semester_dues_uq, "semester_dues_settings", type_="unique"
        )
    op.create_unique_constraint(
        "uq_semester_dues_settings_org_semester",
        "semester_dues_settings",
        ["organization_id", "semester"],
    )

    custom_board_position_uq = _find_unique_constraint_name(
        bind, "custom_board_positions", ["name_normalized"]
    )
    if custom_board_position_uq:
        op.drop_constraint(
            custom_board_position_uq, "custom_board_positions", type_="unique"
        )
    op.create_unique_constraint(
        "uq_custom_board_positions_org_name_normalized",
        "custom_board_positions",
        ["organization_id", "name_normalized"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    custom_board_position_uq = _find_unique_constraint_name(
        bind, "custom_board_positions", ["organization_id", "name_normalized"]
    )
    if custom_board_position_uq:
        op.drop_constraint(
            custom_board_position_uq, "custom_board_positions", type_="unique"
        )
    op.create_unique_constraint(
        "custom_board_positions_name_normalized_key",
        "custom_board_positions",
        ["name_normalized"],
    )

    semester_dues_uq = _find_unique_constraint_name(
        bind, "semester_dues_settings", ["organization_id", "semester"]
    )
    if semester_dues_uq:
        op.drop_constraint(
            semester_dues_uq, "semester_dues_settings", type_="unique"
        )
    op.create_unique_constraint(
        "semester_dues_settings_semester_key",
        "semester_dues_settings",
        ["semester"],
    )

    for table in reversed(P0_TENANT_TABLES):
        op.drop_index(_ix_name(table), table_name=table)
        op.drop_constraint(_fk_name(table), table, type_="foreignkey")
        op.drop_column(table, "organization_id")

    op.drop_index(
        op.f("ix_organization_memberships_custom_board_position_id"),
        table_name="organization_memberships",
    )
    op.drop_index(
        op.f("ix_organization_memberships_organization_id"),
        table_name="organization_memberships",
    )
    op.drop_index(
        op.f("ix_organization_memberships_user_id"),
        table_name="organization_memberships",
    )
    op.drop_index(
        op.f("ix_organization_memberships_id"),
        table_name="organization_memberships",
    )
    op.drop_table("organization_memberships")

    op.drop_column("users", "platform_role")

    op.drop_index(op.f("ix_users_university_id"), table_name="users")
    op.drop_constraint("fk_users_university_id", "users", type_="foreignkey")
    op.drop_column("users", "university_id")

    op.rename_table("users", "members")

    op.drop_index(
        op.f("ix_organizations_university_id"), table_name="organizations"
    )
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_index(op.f("ix_organizations_id"), table_name="organizations")
    op.drop_table("organizations")

    op.drop_index(op.f("ix_universities_slug"), table_name="universities")
    op.drop_index(op.f("ix_universities_id"), table_name="universities")
    op.drop_table("universities")
