/**
 * Edit Member — board+ profile edits; president also role/position.
 * Reused from Quick View, Members table, and Member Workspace header.
 */

import { useEffect, useId, useState, type FormEvent } from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { useAuth } from "../context/useAuth";
import { type MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  updateMemberPosition,
  updateMemberProfile,
  updateMemberRole,
  type MemberPositionAssignment,
  type UpdateProfileRequest,
} from "../lib/members-api";
import {
  MEMBER_TALENT_LABELS,
  MEMBER_TALENTS,
  type MemberTalent,
} from "../lib/member-talents";
import {
  isExclusiveMemberPosition,
  isRoleAtLeast,
  memberHoldsBoardSeat,
  type MemberPosition,
  type PromotableBoardRole,
} from "../lib/roles";
import { getGraduationYearOptions, normalizeSemoEmail } from "../lib/validation";
import { PositionSelect } from "./PositionSelect";
import { RolePromotionSelect } from "./RolePromotionSelect";
import { Button } from "./ui/Button";
import { profileInputClassName } from "./MemberProfileForm";

type EditMemberDrawerProps = {
  member: MemberResponse | null;
  open: boolean;
  onClose: () => void;
  /** Called after any successful profile / role / position update. */
  onMemberUpdated: (
    member: MemberResponse,
    previousHolder?: MemberResponse | null,
  ) => void;
  positionHolders?: Partial<
    Record<MemberPosition, { id: number; full_name: string }>
  >;
};

type EditFormValues = {
  full_name: string;
  email: string;
  major: string;
  graduation_year: string;
  talents: string[];
  talent_other: string;
};

const graduationYears = getGraduationYearOptions();

function toFormValues(member: MemberResponse): EditFormValues {
  return {
    full_name: member.full_name,
    email: member.email ?? "",
    major: member.major,
    graduation_year: String(member.graduation_year),
    talents: [...(member.talents ?? [])],
    talent_other: member.talent_other ?? "",
  };
}

function toProfileRequest(values: EditFormValues): UpdateProfileRequest {
  const talents = values.talents;
  return {
    full_name: values.full_name.trim(),
    email: normalizeSemoEmail(values.email),
    major: values.major.trim(),
    graduation_year: Number(values.graduation_year),
    talents: talents as MemberTalent[],
    talent_other: talents.includes("other")
      ? values.talent_other.trim() || null
      : null,
  };
}

export function EditMemberDrawer({
  member,
  open,
  onClose,
  onMemberUpdated,
  positionHolders,
}: EditMemberDrawerProps) {
  const { member: currentMember } = useAuth();
  const formId = useId();
  const [draftMember, setDraftMember] = useState<MemberResponse | null>(member);
  const [values, setValues] = useState<EditFormValues | null>(
    member ? toFormValues(member) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isUpdatingPosition, setIsUpdatingPosition] = useState(false);

  const canEditProfile = Boolean(
    currentMember && isRoleAtLeast(currentMember.role, "board"),
  );
  const canEditRolePosition = Boolean(
    currentMember && isRoleAtLeast(currentMember.role, "president"),
  );

  useEffect(() => {
    if (!open || !member) {
      return;
    }
    setDraftMember(member);
    setValues(toFormValues(member));
    setError(null);
    setIsSavingProfile(false);
    setIsUpdatingRole(false);
    setIsUpdatingPosition(false);
  }, [open, member]);

  if (!open || !member || !draftMember || !values) {
    return null;
  }

  if (!canEditProfile) {
    return null;
  }

  function updateField<K extends keyof EditFormValues>(
    key: K,
    next: EditFormValues[K],
  ) {
    setValues((prev) => (prev ? { ...prev, [key]: next } : prev));
  }

  function toggleTalent(talent: string) {
    setValues((prev) => {
      if (!prev) {
        return prev;
      }
      const next = prev.talents.includes(talent)
        ? prev.talents.filter((item) => item !== talent)
        : [...prev.talents, talent];
      return { ...prev, talents: next };
    });
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!draftMember || !values || isSavingProfile) {
      return;
    }
    setIsSavingProfile(true);
    setError(null);
    try {
      const updated = await updateMemberProfile(
        draftMember.id,
        toProfileRequest(values),
      );
      setDraftMember(updated);
      setValues(toFormValues(updated));
      onMemberUpdated(updated);
      onClose();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleRoleChange(
    memberId: number,
    role: PromotableBoardRole,
  ) {
    setIsUpdatingRole(true);
    setError(null);
    try {
      const updated = await updateMemberRole(memberId, { role });
      setDraftMember(updated);
      onMemberUpdated(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsUpdatingRole(false);
    }
  }

  async function handlePositionChange(
    memberId: number,
    assignment: MemberPositionAssignment,
  ) {
    setIsUpdatingPosition(true);
    setError(null);
    try {
      const updated = await updateMemberPosition(memberId, assignment);
      setDraftMember(updated);
      onMemberUpdated(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsUpdatingPosition(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="md"
      closeOnBackdrop
      showClose
      className="members-edit-drawer"
      title="Edit Member"
      description={`Update details for ${draftMember.full_name}.`}
      footer={
        <div className="members-edit-footer">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSavingProfile}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="sm"
            loading={isSavingProfile}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="members-edit-form"
        onSubmit={(event) => void handleSaveProfile(event)}
      >
        {error ? (
          <p className="ds-field-error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="members-invite-section" aria-label="Profile">
          <div className="members-invite-section-header">
            <h3 className="members-invite-section-title">Profile</h3>
            <p className="members-invite-section-desc">
              Name, contact, academic details, and talents.
            </p>
          </div>
          <div className="members-invite-section-body members-edit-fields">
            <div>
              <label
                htmlFor={`${formId}-full_name`}
                className="block text-sm font-medium text-foreground"
              >
                Full name
              </label>
              <input
                id={`${formId}-full_name`}
                data-drawer-initial-focus
                value={values.full_name}
                onChange={(event) =>
                  updateField("full_name", event.target.value)
                }
                className={profileInputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-email`}
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={profileInputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-major`}
                className="block text-sm font-medium text-foreground"
              >
                Major
              </label>
              <input
                id={`${formId}-major`}
                value={values.major}
                onChange={(event) => updateField("major", event.target.value)}
                className={profileInputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-graduation_year`}
                className="block text-sm font-medium text-foreground"
              >
                Graduation year
              </label>
              <select
                id={`${formId}-graduation_year`}
                value={values.graduation_year}
                onChange={(event) =>
                  updateField("graduation_year", event.target.value)
                }
                className={profileInputClassName}
              >
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="members-edit-talents">
              <p className="text-sm font-medium text-foreground">Talents</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MEMBER_TALENTS.map((talent) => {
                  const selected = values.talents.includes(talent);
                  return (
                    <button
                      key={talent}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTalent(talent)}
                      className={[
                        "ds-chip",
                        selected
                          ? "bg-primary text-white"
                          : "border border-gray-200 bg-white text-label hover:text-foreground",
                      ].join(" ")}
                    >
                      {MEMBER_TALENT_LABELS[talent]}
                    </button>
                  );
                })}
              </div>
              {values.talents.includes("other") ? (
                <input
                  aria-label="Other talent description"
                  value={values.talent_other}
                  onChange={(event) =>
                    updateField("talent_other", event.target.value)
                  }
                  placeholder="Describe other talent"
                  className={`${profileInputClassName} mt-3`}
                />
              ) : null}
            </div>
          </div>
        </section>

        {canEditRolePosition ? (
          <section
            className="members-invite-section"
            aria-label="Role and position"
          >
            <div className="members-invite-section-header">
              <h3 className="members-invite-section-title">
                Role &amp; position
              </h3>
              <p className="members-invite-section-desc">
                President-only. Changes save immediately.
              </p>
            </div>
            <div className="members-invite-section-body members-edit-role-row">
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">Role</p>
                <RolePromotionSelect
                  member={draftMember}
                  isUpdating={isUpdatingRole}
                  onRoleChange={handleRoleChange}
                />
                {memberHoldsBoardSeat(draftMember) &&
                isExclusiveMemberPosition(draftMember.position) ? (
                  <p className="mt-1 text-xs text-label">
                    Role is tied to this exclusive position.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">
                  Position
                </p>
                <PositionSelect
                  member={draftMember}
                  isUpdating={isUpdatingPosition}
                  positionHolders={positionHolders}
                  onPositionChange={handlePositionChange}
                />
              </div>
            </div>
          </section>
        ) : null}
      </form>
    </Drawer>
  );
}
