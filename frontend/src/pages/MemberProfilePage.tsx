/**
 * Member Profile — balanced two-column premium layout.
 * Data fetching / edit / admin flows unchanged; domain panels are presentation-first.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ClipboardList,
  FileText,
  StickyNote,
} from "lucide-react";

import { MemberActivityTimeline } from "../components/MemberActivityTimeline";
import { MemberAiInsightsCard } from "../components/MemberAiInsightsCard";
import { MemberAttendancePanel } from "../components/MemberAttendancePanel";
import { MemberHealthPanel } from "../components/MemberHealthPanel";
import { MemberPaymentsPanel } from "../components/MemberPaymentsPanel";
import {
  MemberProfileForm,
  memberToProfileFormValues,
  profileFormValuesToRequest,
  type MemberProfileFormValues,
} from "../components/MemberProfileForm";
import { PositionSelect } from "../components/PositionSelect";
import { RoleBadge } from "../components/RoleBadge";
import { RolePromotionSelect } from "../components/RolePromotionSelect";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { Avatar } from "../design-system/components/Avatar";
import { Skeleton } from "../design-system/components/Skeleton";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage, type MemberResponse } from "../lib/auth-api";
import {
  fetchMemberById,
  updateMemberProfile,
  updateMyProfile,
  updateMemberPosition,
  updateMemberRole,
} from "../lib/members-api";
import {
  buildMemberContactLine,
  formatTalentLabel,
} from "../lib/member-talents";
import {
  buildPositionHolders,
  canPresidentPromoteMember,
  canViewMemberDirectory,
  formatPositionLabel,
  isRoleAtLeast,
  type MemberPosition,
  type PromotableBoardRole,
} from "../lib/roles";
import { getMembershipAdminErrorMessage } from "../lib/membership-admin-errors";

function ProfileSection({
  title,
  description,
  children,
  actions,
  scrollable = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Caps tall panel content so the page stays browseable. */
  scrollable?: boolean;
}) {
  return (
    <section className="member-profile-section" aria-label={title}>
      <div className="member-profile-section-header">
        <div className="min-w-0">
          <h2 className="member-profile-section-title">{title}</h2>
          {description ? (
            <p className="member-profile-section-desc">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div
        className={
          scrollable
            ? "member-profile-section-body is-scrollable"
            : "member-profile-section-body"
        }
        tabIndex={scrollable ? 0 : undefined}
        aria-label={scrollable ? `${title} details` : undefined}
      >
        {children}
      </div>
    </section>
  );
}

function EmptyHint({
  icon,
  title,
  description,
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
}) {
  return (
    <div className="member-profile-empty-card" role="status">
      <span className="member-profile-empty-icon" aria-hidden="true">
        <AppIcon icon={icon} size="sm" className="text-current" />
      </span>
      <div className="min-w-0">
        <p className="member-profile-empty-title">{title}</p>
        <p className="member-profile-empty-desc">{description}</p>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="member-profile-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function MemberProfilePage() {
  const { memberId } = useParams();
  const numericMemberId = Number(memberId);
  const { member: currentMember } = useAuth();
  const [profile, setProfile] = useState<MemberResponse | null>(null);
  const [values, setValues] = useState<MemberProfileFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [updatingPosition, setUpdatingPosition] = useState(false);

  const isBoard = currentMember
    ? isRoleAtLeast(currentMember.role, "board")
    : false;
  const isPresident = currentMember?.role === "president";
  const isSelf = currentMember?.id === profile?.id;
  const canEdit = isSelf || isBoard;

  useEffect(() => {
    if (!Number.isFinite(numericMemberId)) {
      setError("Invalid member.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchMemberById(numericMemberId)
      .then((member) => {
        if (!cancelled) {
          setProfile(member);
          setValues(memberToProfileFormValues(member));
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericMemberId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !values || !canEdit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = isSelf
        ? await updateMyProfile(profileFormValuesToRequest(values))
        : await updateMemberProfile(
            profile.id,
            profileFormValuesToRequest(values),
          );
      setProfile(updated);
      setValues(memberToProfileFormValues(updated));
      setIsEditing(false);
      setSuccessMessage("Profile updated successfully.");
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRoleChange(
    _memberId: number,
    role: PromotableBoardRole,
  ) {
    if (!profile) return;
    setUpdatingRole(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateMemberRole(profile.id, { role });
      setProfile(updated);
      setValues(memberToProfileFormValues(updated));
    } catch (caught) {
      setError(getMembershipAdminErrorMessage(caught));
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handlePositionChange(
    _memberId: number,
    position: MemberPosition,
  ) {
    if (!profile) return;
    setUpdatingPosition(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateMemberPosition(profile.id, position);
      setProfile(updated);
      setValues(memberToProfileFormValues(updated));
    } catch (caught) {
      setError(getMembershipAdminErrorMessage(caught));
    } finally {
      setUpdatingPosition(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="member-profile-page"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="sr-only">Loading profile…</p>
        <div className="member-profile-hero">
          <Skeleton height={14} width={120} />
          <div className="member-profile-hero-main mt-4">
            <Skeleton height={64} width={64} variant="circular" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton height={28} width="45%" />
              <Skeleton height={14} width="30%" />
              <div className="flex gap-2">
                <Skeleton height={24} width={72} />
                <Skeleton height={24} width={72} />
              </div>
            </div>
          </div>
        </div>
        <div className="member-profile-grid">
          <div className="member-profile-column space-y-4">
            <div className="member-profile-section space-y-3">
              <Skeleton height={16} width="35%" />
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="90%" />
            </div>
            <div className="member-profile-section space-y-3">
              <Skeleton height={16} width="40%" />
              <Skeleton height={72} width="100%" />
            </div>
          </div>
          <div className="member-profile-column space-y-4">
            <div className="member-profile-section space-y-3">
              <Skeleton height={16} width="35%" />
              <Skeleton height={72} width="100%" />
            </div>
            <div className="member-profile-section space-y-3">
              <Skeleton height={16} width="40%" />
              <Skeleton height={96} width="100%" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !values) {
    return (
      <div className="member-profile-page">
        <p className="ds-field-error">{error ?? "Member not found."}</p>
      </div>
    );
  }

  const contactLine = buildMemberContactLine(profile);
  const positionHolders = buildPositionHolders([profile]);
  const talents = profile.talents ?? [];
  const showMembershipAdmin =
    isPresident &&
    Boolean(currentMember) &&
    canViewMemberDirectory(currentMember!.role);

  return (
    <div className="member-profile-page">
      <header className="member-profile-hero">
        <Link to="/members" className="member-profile-back">
          <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
          Back to Members
        </Link>

        <div className="member-profile-hero-main">
          <Avatar name={profile.full_name} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="member-profile-name">{profile.full_name}</h1>
            <p className="member-profile-hero-meta">
              {profile.major} · Class of {profile.graduation_year}
            </p>
            <div className="member-profile-hero-badges">
              <RoleBadge role={profile.role} size="md" />
              <StatusBadge status={profile.status} />
              <span className="member-profile-position-chip">
                {formatPositionLabel(profile.position)}
              </span>
            </div>
          </div>

          {canEdit && !isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="member-profile-hero-action"
              onClick={() => setIsEditing(true)}
            >
              Edit profile
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="ds-alert-banner rounded-xl px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <p className="member-profile-success" role="status">
          {successMessage}
        </p>
      ) : null}

      {isEditing && canEdit ? (
        <form
          className="member-profile-section member-profile-edit"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="member-profile-section-header">
            <div>
              <h2 className="member-profile-section-title">
                {isSelf ? "Edit your profile" : "Edit member profile"}
              </h2>
              <p className="member-profile-section-desc">
                Updates appear across the directory and event workflows.
              </p>
            </div>
          </div>
          <div className="member-profile-section-body">
            <MemberProfileForm
              values={values}
              studentId={isSelf || isBoard ? profile.student_id : undefined}
              onChange={setValues}
              idPrefix={`member-${profile.id}`}
            />
            <div className="member-profile-edit-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setValues(memberToProfileFormValues(profile));
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                Save changes
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="member-profile-grid">
          <div className="member-profile-column">
            <ProfileSection
              title="Overview"
              description="Identity, talents, and contact."
            >
              <dl className="member-profile-meta-list">
                <MetaRow label="Major" value={profile.major} />
                <MetaRow
                  label="Graduation"
                  value={String(profile.graduation_year)}
                />
                <MetaRow
                  label="Position"
                  value={formatPositionLabel(profile.position)}
                />
                <MetaRow
                  label="Contact"
                  value={contactLine || "No public contact shared"}
                />
                {isBoard && profile.student_id ? (
                  <MetaRow label="Student ID" value={profile.student_id} />
                ) : null}
              </dl>

              {talents.length > 0 ? (
                <div className="member-profile-block">
                  <p className="member-profile-eyebrow">Talents</p>
                  <ul className="member-profile-chip-list">
                    {talents.map((talent) => (
                      <li key={talent} className="member-profile-chip">
                        {formatTalentLabel(talent, profile.talent_other)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {profile.interests ? (
                <div className="member-profile-block">
                  <p className="member-profile-eyebrow">Interests</p>
                  <p className="member-profile-prose">{profile.interests}</p>
                </div>
              ) : null}

              {profile.bio ? (
                <div className="member-profile-block">
                  <p className="member-profile-eyebrow">Bio</p>
                  <p className="member-profile-prose is-clamped">{profile.bio}</p>
                </div>
              ) : null}
            </ProfileSection>

            <ProfileSection
              title="Attendance"
              description="Event and meeting participation."
              scrollable
            >
              <MemberAttendancePanel />
            </ProfileSection>

            <ProfileSection
              title="Tasks"
              description="Assigned and completed work."
            >
              <EmptyHint
                icon={ClipboardList}
                title="No tasks yet"
                description="Assigned board work will appear here."
              />
            </ProfileSection>

            <ProfileSection
              title="Payments"
              description="Dues and related balances."
              scrollable
            >
              <MemberPaymentsPanel />
            </ProfileSection>
          </div>

          <div className="member-profile-column">
            <ProfileSection
              title="Member Health"
              description="Engagement score from attendance, tasks, dues, and activity."
            >
              <MemberHealthPanel
                embedded
                memberId={profile.id}
                role={profile.role}
              />
            </ProfileSection>

            <ProfileSection
              title="AI Insights"
              description="Preview signals and suggested next steps."
            >
              <MemberAiInsightsCard embedded />
            </ProfileSection>

            <ProfileSection
              title="Documents"
              description="Files shared with leadership."
            >
              <EmptyHint
                icon={FileText}
                title="No documents yet"
                description="Uploaded files and forms will appear here."
              />
            </ProfileSection>

            <ProfileSection
              title="Notes"
              description="Private board context for this member."
            >
              <EmptyHint
                icon={StickyNote}
                title="No notes yet"
                description="Leadership notes stay private to the board."
              />
            </ProfileSection>

            <ProfileSection
              title="Activity Timeline"
              description="Recent milestones and updates."
              scrollable
            >
              <MemberActivityTimeline placeholdersWhenEmpty />
            </ProfileSection>

            {showMembershipAdmin ? (
              <ProfileSection
                title="Membership admin"
                description="Access level and board position."
              >
                <div className="member-profile-admin">
                  <div className="member-profile-admin-field">
                    <p className="member-profile-eyebrow">Access level</p>
                    {canPresidentPromoteMember(profile, currentMember!.id) ? (
                      <RolePromotionSelect
                        member={profile}
                        isUpdating={updatingRole}
                        onRoleChange={handleRoleChange}
                      />
                    ) : (
                      <RoleBadge role={profile.role} size="md" />
                    )}
                  </div>

                  <div className="member-profile-admin-field">
                    <p className="member-profile-eyebrow">Board position</p>
                    {profile.role === "general" ? (
                      <p className="member-profile-admin-static">Member</p>
                    ) : (
                      <PositionSelect
                        member={profile}
                        positionHolders={positionHolders}
                        isUpdating={updatingPosition}
                        onPositionChange={handlePositionChange}
                      />
                    )}
                  </div>
                </div>
              </ProfileSection>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
