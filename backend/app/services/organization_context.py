"""Phase 1 multi-tenant helpers.

Everything currently runs against a single seeded university/organization
(SEMO / NSA, id=1). These helpers centralize that assumption so call sites
don't hardcode `1` and can be swapped for real tenant resolution later.
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
    position still live on `Member` directly.
    """
    organization_id = get_default_organization_id(db)
    membership = get_membership_for_user(db, member.id, organization_id)
    if membership is not None:
        return membership

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
    db.flush()
    return membership
