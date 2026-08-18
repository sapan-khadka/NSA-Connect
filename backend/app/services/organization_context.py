"""Multi-tenant helpers (single-tenant runtime today).

Everything currently runs against one seeded university/organization
(SEMO / NSA via settings slugs). Call sites must use these helpers — never
hardcode organization id or slug literals in services.
"""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.member import Member
from app.models.organization import Organization, OrganizationStatus
from app.models.organization_membership import OrganizationMembership
from app.models.university import University

DEFAULT_ORG_SLUG = settings.DEFAULT_ORGANIZATION_SLUG


def ensure_default_university_and_org(db: Session) -> tuple[University, Organization]:
    """Idempotently create the seeded default university + organization.

    Safe to call repeatedly (e.g. on every app/test startup) — returns the
    existing rows if they're already present.
    """
    university = db.query(University).filter(
        University.slug == settings.DEFAULT_UNIVERSITY_SLUG
    ).one_or_none()
    if university is None:
        university = University(
            name=settings.DEFAULT_UNIVERSITY_NAME,
            slug=settings.DEFAULT_UNIVERSITY_SLUG,
            email_domain=settings.DEFAULT_UNIVERSITY_EMAIL_DOMAIN,
        )
        db.add(university)
        db.flush()

    organization = db.query(Organization).filter(
        Organization.slug == settings.DEFAULT_ORGANIZATION_SLUG
    ).one_or_none()
    if organization is None:
        organization = Organization(
            university_id=university.id,
            name=settings.DEFAULT_ORGANIZATION_NAME,
            slug=settings.DEFAULT_ORGANIZATION_SLUG,
            status=OrganizationStatus.ACTIVE,
        )
        db.add(organization)
        db.flush()

    db.commit()
    return university, organization


def ensure_nsa_org_owner(db: Session) -> OrganizationMembership | None:
    """Ensure the default NSA org has at least one is_org_owner membership.

    Prefers an approved president membership; otherwise the lowest-id approved
    board+ membership. No-op when the org has no approved members yet.
    Idempotent. Never deletes or demotes members.
    """
    from sqlalchemy import select

    from app.models.member import MemberRole, MemberStatus
    from app.models.organization_membership import OrganizationMembership

    organization = get_default_organization(db)
    existing_owner = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.is_org_owner.is_(True),
        ),
    )
    if existing_owner is not None:
        return existing_owner

    president = db.scalar(
        select(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.status == MemberStatus.APPROVED,
            OrganizationMembership.role == MemberRole.PRESIDENT,
        )
        .order_by(OrganizationMembership.id.asc()),
    )
    candidate = president
    if candidate is None:
        candidate = db.scalar(
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.status == MemberStatus.APPROVED,
                OrganizationMembership.role.in_(
                    (
                        MemberRole.PRESIDENT,
                        MemberRole.TREASURER,
                        MemberRole.BOARD,
                    ),
                ),
            )
            .order_by(OrganizationMembership.id.asc()),
        )
    if candidate is None:
        return None

    candidate.is_org_owner = True
    db.commit()
    db.refresh(candidate)
    return candidate


def default_org_has_approved_member(db: Session) -> bool:
    """True when the default org already has at least one approved membership."""
    from sqlalchemy import select

    from app.models.member import MemberStatus
    from app.models.organization_membership import OrganizationMembership

    organization_id = get_default_organization_id(db)
    return (
        db.scalar(
            select(OrganizationMembership.id)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.status == MemberStatus.APPROVED,
            )
            .limit(1),
        )
        is not None
    )


def bootstrap_first_org_owner(db: Session, member: Member) -> bool:
    """Promote the registrant to approved org owner when appropriate.

    Org owner is a system flag (`is_org_owner`), not the chapter president seat.
    The owner remains a general member and appoints a president separately.

    Rules:
    - If ORG_OWNER_EMAILS is configured: only those emails are promoted (even when
      other pending members exist; skips when an approved owner already exists).
    - If ORG_OWNER_EMAILS is empty: legacy empty-org recovery — first registrant
      on an org with no approved members becomes owner (SEMO students included).
    """
    from sqlalchemy import select

    from app.core.validators import is_org_owner_email, org_owner_emails_configured
    from app.models.member import MemberPosition, MemberRole, MemberStatus

    organization = get_default_organization(db)
    # Serialize concurrent first registrations (honored on Postgres).
    db.execute(
        select(Organization.id)
        .where(Organization.id == organization.id)
        .with_for_update(),
    )

    allowlist_configured = org_owner_emails_configured()
    if allowlist_configured:
        if not is_org_owner_email(member.email or ""):
            return False
        # Prefer not to create a second owner if one already exists.
        existing_owner = db.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.is_org_owner.is_(True),
                OrganizationMembership.status == MemberStatus.APPROVED,
            ),
        )
        if existing_owner is not None and existing_owner.user_id != member.id:
            return False
    elif default_org_has_approved_member(db):
        return False

    member.status = MemberStatus.APPROVED
    # Owner is not the chapter president — they appoint one later.
    member.role = MemberRole.GENERAL
    member.position = MemberPosition.MEMBER
    sync_membership_from_member(db, member, organization_id=organization.id)
    membership = get_membership_for_user(db, member.id, organization.id)
    if membership is None:
        membership = ensure_membership_for_member(db, member)
    membership.is_org_owner = True
    db.commit()
    db.refresh(member)
    db.refresh(membership)
    return True


def get_default_university(db: Session) -> University:
    university = db.query(University).filter(
        University.slug == settings.DEFAULT_UNIVERSITY_SLUG
    ).one_or_none()
    if university is None:
        university, _ = ensure_default_university_and_org(db)
    return university


def get_default_university_id(db: Session) -> int:
    return get_default_university(db).id


def get_default_organization(db: Session) -> Organization:
    organization = db.query(Organization).filter(
        Organization.slug == settings.DEFAULT_ORGANIZATION_SLUG
    ).one_or_none()
    if organization is None:
        _, organization = ensure_default_university_and_org(db)
    return organization


def get_default_organization_id(db: Session) -> int:
    return get_default_organization(db).id


def resolve_organization_id(db: Session, member: Member | None = None) -> int:
    """Prefer the request-scoped active org; otherwise the seeded default."""
    if member is not None:
        organization_id = getattr(member, "_active_organization_id", None)
        if organization_id is not None:
            return int(organization_id)
    return get_default_organization_id(db)


def get_membership_for_user(
    db: Session,
    user_id: int,
    organization_id: int | None = None,
) -> OrganizationMembership | None:
    if organization_id is None:
        organization_id = get_default_organization_id(db)
    return (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == organization_id,
        )
        .one_or_none()
    )


def ensure_membership_for_member(db: Session, member: Member) -> OrganizationMembership:
    """Create (or return the existing) default-org membership mirroring `member`.

    Used during the Phase 1 transition period while org-scoped role/status/
    position still live on `Member` directly. If the membership already exists
    but drifted from `users.*` (e.g. a test or legacy path mutated Member
    without sync), realign role/status/position without touching is_org_owner.
    """
    organization_id = get_default_organization_id(db)
    membership = get_membership_for_user(db, member.id, organization_id)
    if membership is None:
        membership = OrganizationMembership(
            user_id=member.id,
            organization_id=organization_id,
            role=member.role,
            status=member.status,
            position=member.position,
            custom_board_position_id=member.custom_board_position_id,
        )
        db.add(membership)
        db.commit()
        db.refresh(membership)
        return membership

    drifted = (
        membership.role != member.role
        or membership.status != member.status
        or membership.position != member.position
        or membership.custom_board_position_id != member.custom_board_position_id
    )
    if drifted:
        sync_membership_from_member(db, member, organization_id=organization_id)
        db.commit()
        db.refresh(membership)
    return membership


def sync_membership_from_member(
    db: Session,
    member: Member,
    *,
    organization_id: int | None = None,
) -> OrganizationMembership:
    """Upsert the default-org membership to mirror `member`'s current
    role/status/position/custom_board_position_id.

    Call this from `member_service` whenever any of those fields change
    (approve, reject, role update, position assignment) so
    `organization_memberships` stays in lockstep with the legacy `users`
    columns during the Phase 1 transition. Does not commit; callers already
    commit the `Member` mutation in the same transaction.
    """
    if organization_id is None:
        organization_id = get_default_organization_id(db)

    membership = get_membership_for_user(db, member.id, organization_id)
    if membership is None:
        membership = OrganizationMembership(
            user_id=member.id,
            organization_id=organization_id,
        )
        db.add(membership)

    membership.role = member.role
    membership.status = member.status
    membership.position = member.position
    membership.custom_board_position_id = member.custom_board_position_id
    # is_org_owner is system-managed; never overwrite from Member dual-write.
    db.flush()
    return membership
