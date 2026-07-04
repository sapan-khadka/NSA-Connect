import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

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
  getMemberInitials,
} from "../lib/member-talents";
import {
  buildPositionHolders,
  canPresidentPromoteMember,
  canViewMemberDirectory,
  formatPositionLabel,
  isExclusiveMemberPosition,
  isRoleAtLeast,
  type PromotableBoardRole,
} from "../lib/roles";

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

  const isBoard = currentMember ? isRoleAtLeast(currentMember.role, "board") : false;
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
        : await updateMemberProfile(profile.id, profileFormValuesToRequest(values));
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

  async function handleRoleChange(role: PromotableBoardRole) {
    if (!profile) return;
    setUpdatingRole(true);
    try {
      const updated = await updateMemberRole(profile.id, { role });
      setProfile(updated);
      setValues(memberToProfileFormValues(updated));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handlePositionChange(position: Parameters<typeof updateMemberPosition>[1]) {
    if (!profile) return;
    setUpdatingPosition(true);
    try {
      const updated = await updateMemberPosition(profile.id, position);
      setProfile(updated);
      setValues(memberToProfileFormValues(updated));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setUpdatingPosition(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-label">Loading profile…</p>;
  }

  if (!profile || !values) {
    return <p className="ds-field-error">{error ?? "Member not found."}</p>;
  }

  const contactLine = buildMemberContactLine(profile);
  const positionHolders = buildPositionHolders([profile]);

  return (
    <div className="space-y-6">
      <section className="ds-card p-8">
        <Link to="/members" className="text-sm text-accent hover:underline">
          ← Back to directory
        </Link>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E7EBF1] bg-[#FAFAF9] text-lg font-medium text-foreground">
            {getMemberInitials(profile.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-light tracking-headline text-foreground">
              {profile.full_name}
            </h1>
            <p className="mt-2 text-sm text-label">
              {profile.major} · {profile.graduation_year}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoleBadge role={profile.role} size="md" />
              <StatusBadge status={profile.status} />
              <span className="text-sm text-label">
                {formatPositionLabel(profile.position)}
              </span>
            </div>
          </div>
          {canEdit && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm text-foreground"
            >
              Edit profile
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="ds-alert-banner">{error}</div> : null}
      {successMessage ? (
        <div className="rounded-lg ds-card px-4 py-3 text-sm text-primary">
          {successMessage}
        </div>
      ) : null}

      {isEditing && canEdit ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="ds-card p-6">
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            {isSelf ? "Edit your profile" : "Edit member profile"}
          </h2>
          <div className="mt-6">
            <MemberProfileForm
              values={values}
              studentId={isSelf || isBoard ? profile.student_id : undefined}
              onChange={setValues}
              idPrefix={`member-${profile.id}`}
            />
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setValues(memberToProfileFormValues(profile));
                setIsEditing(false);
              }}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <section className="ds-card p-6">
          {(profile.talents ?? []).length > 0 ? (
            <div>
              <h2 className="text-base font-medium text-foreground">Talents</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(profile.talents ?? []).map((talent) => (
                  <li
                    key={talent}
                    className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs text-label"
                  >
                    {formatTalentLabel(talent, profile.talent_other)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {profile.interests ? (
            <div className="mt-6">
              <h2 className="text-base font-medium text-foreground">Interests</h2>
              <p className="mt-2 text-sm text-foreground">{profile.interests}</p>
            </div>
          ) : null}

          {profile.bio ? (
            <div className="mt-6">
              <h2 className="text-base font-medium text-foreground">Bio</h2>
              <p className="mt-2 text-sm text-foreground">{profile.bio}</p>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="text-base font-medium text-foreground">Contact</h2>
            {contactLine ? (
              <p className="mt-2 text-sm text-foreground">{contactLine}</p>
            ) : (
              <p className="mt-2 text-sm text-label">No public contact info shared.</p>
            )}
          </div>

          {isBoard && profile.student_id ? (
            <div className="mt-6">
              <h2 className="text-base font-medium text-foreground">Student ID</h2>
              <p className="mt-2 text-sm text-foreground">{profile.student_id}</p>
            </div>
          ) : null}
        </section>
      )}

      {isPresident && currentMember && canViewMemberDirectory(currentMember.role) ? (
        <section className="ds-card p-6">
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            Membership admin
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {isExclusiveMemberPosition(profile.position) ? (
              <RoleBadge role={profile.role} size="md" />
            ) : canPresidentPromoteMember(profile, currentMember.id) ? (
              <RolePromotionSelect
                member={profile}
                isUpdating={updatingRole}
                onRoleChange={handleRoleChange}
              />
            ) : (
              <RoleBadge role={profile.role} size="md" />
            )}
            <PositionSelect
              member={profile}
              positionHolders={positionHolders}
              isUpdating={updatingPosition}
              onPositionChange={handlePositionChange}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
