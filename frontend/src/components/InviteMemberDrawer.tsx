/**
 * Invite Member — professional side drawer. UX / validation only. No backend.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { Input } from "../design-system/components/Input";
import { Select } from "../design-system/components/Select";
import {
  clearInviteDraft,
  EMPTY_INVITE_FORM,
  firstInviteErrorField,
  loadInviteDraft,
  saveInviteDraft,
  validateInviteField,
  validateInviteForm,
  type InviteFormErrors,
  type InviteFormValues,
} from "../lib/invite-member-form";
import { MEMBER_ROLES } from "../lib/roles";
import { Button } from "./ui/Button";

const ROLE_OPTIONS = MEMBER_ROLES.map((role) => ({
  value: role,
  label: role.charAt(0).toUpperCase() + role.slice(1),
}));

const ORGANIZATION_OPTIONS = [
  { value: "nsa-main", label: "NSA — Main Chapter" },
  { value: "nsa-grad", label: "NSA — Graduate Chapter" },
  { value: "cultural", label: "Cultural Affairs" },
  { value: "outreach", label: "Community Outreach" },
];

const COMMITTEE_OPTIONS = [
  { value: "events", label: "Events" },
  { value: "finance", label: "Finance" },
  { value: "outreach", label: "Outreach" },
  { value: "academic", label: "Academic" },
];

const GRADUATION_YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030].map((year) => ({
  value: String(year),
  label: String(year),
}));

type InviteMemberDrawerProps = {
  open: boolean;
  onClose: () => void;
};

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section className="members-invite-section" aria-labelledby={headingId}>
      <div className="members-invite-section-header">
        <h3 id={headingId} className="members-invite-section-title">
          {title}
        </h3>
        {description ? (
          <p className="members-invite-section-desc">{description}</p>
        ) : null}
      </div>
      <div className="members-invite-section-body">{children}</div>
    </section>
  );
}

function RequiredMark() {
  return (
    <span className="members-invite-required" aria-hidden="true">
      *
    </span>
  );
}

export function InviteMemberDrawer({ open, onClose }: InviteMemberDrawerProps) {
  const [values, setValues] = useState<InviteFormValues>(EMPTY_INVITE_FORM);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof InviteFormValues, boolean>>
  >({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const draft = loadInviteDraft();
    setValues(draft ?? EMPTY_INVITE_FORM);
    setErrors({});
    setTouched({});
    setDraftSaved(false);
    setAttemptedSubmit(false);
  }, [open]);

  function updateField<K extends keyof InviteFormValues>(
    key: K,
    next: InviteFormValues[K],
  ) {
    const nextValues = { ...values, [key]: next };
    setValues(nextValues);
    setDraftSaved(false);

    if (attemptedSubmit || touched[key]) {
      const message = validateInviteField(key, nextValues);
      setErrors((current) => {
        const nextErrors = { ...current };
        if (message) {
          nextErrors[key] = message;
        } else {
          delete nextErrors[key];
        }
        return nextErrors;
      });
    }
  }

  function handleBlur(key: keyof InviteFormValues) {
    setTouched((current) => ({ ...current, [key]: true }));
    setErrors((current) => {
      const message = validateInviteField(key, values);
      const nextErrors = { ...current };
      if (message) {
        nextErrors[key] = message;
      } else {
        delete nextErrors[key];
      }
      return nextErrors;
    });
  }

  function handleCancel() {
    setErrors({});
    setTouched({});
    setAttemptedSubmit(false);
    onClose();
  }

  function handleSaveDraft() {
    saveInviteDraft(values);
    setDraftSaved(true);
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    const nextErrors = validateInviteForm(values);
    setErrors(nextErrors);

    const firstError = firstInviteErrorField(nextErrors);
    if (firstError) {
      const field = formRef.current?.querySelector<HTMLElement>(
        `[name="${firstError}"]`,
      );
      field?.focus();
      if (typeof field?.scrollIntoView === "function") {
        field.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    // No backend invite endpoint wired — keep invitation local-only for now.
    clearInviteDraft();
    setDraftSaved(false);
    setValues(EMPTY_INVITE_FORM);
    setTouched({});
    setAttemptedSubmit(false);
    onClose();
  }

  const errorCount = Object.keys(errors).length;

  return (
    <Drawer
      open={open}
      onClose={handleCancel}
      side="right"
      size="lg"
      title="Invite Member"
      description="Add someone to your organization. Drafts stay on this device."
      className="members-invite-drawer"
      footer={
        <div className="members-invite-footer">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="members-invite-footer-cancel"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <div className="members-invite-footer-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => formRef.current?.requestSubmit()}
            >
              Invite
            </Button>
          </div>
        </div>
      }
    >
      <form
        ref={formRef}
        className="members-invite-form"
        onSubmit={handleInvite}
        noValidate
      >
        {draftSaved ? (
          <p className="members-invite-banner is-success" role="status">
            Draft saved on this device.
          </p>
        ) : null}
        {attemptedSubmit && errorCount > 0 ? (
          <p className="members-invite-banner is-error" role="alert">
            {errorCount === 1
              ? "1 field needs attention before you can send the invite."
              : `${errorCount} fields need attention before you can send the invite.`}
          </p>
        ) : null}

        <FormSection
          title="Personal"
          description="How this member will appear across CampusOS."
        >
          <div className="members-invite-grid">
            <Input
              label={
                <>
                  First name <RequiredMark />
                </>
              }
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              error={errors.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              onBlur={() => handleBlur("firstName")}
              placeholder="Alex"
              required
              maxLength={60}
            />
            <Input
              label={
                <>
                  Last name <RequiredMark />
                </>
              }
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              error={errors.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              onBlur={() => handleBlur("lastName")}
              placeholder="Member"
              required
              maxLength={60}
            />
          </div>
        </FormSection>

        <FormSection
          title="Organization"
          description="Which chapter or group they are joining."
        >
          <Select
            label={
              <>
                Organization <RequiredMark />
              </>
            }
            name="organization"
            options={ORGANIZATION_OPTIONS}
            placeholder="Select an organization"
            value={values.organization}
            error={errors.organization}
            onChange={(event) =>
              updateField("organization", event.target.value)
            }
            onBlur={() => handleBlur("organization")}
            required
          />
        </FormSection>

        <FormSection
          title="Role"
          description="Controls access level after they accept."
        >
          <Select
            label={
              <>
                Member role <RequiredMark />
              </>
            }
            name="role"
            options={ROLE_OPTIONS}
            placeholder="Select a role"
            value={values.role}
            error={errors.role}
            onChange={(event) => updateField("role", event.target.value)}
            onBlur={() => handleBlur("role")}
            required
          />
        </FormSection>

        <FormSection
          title="Committee"
          description="Optional group assignment for reporting and outreach."
        >
          <Select
            label="Committee"
            name="committee"
            options={COMMITTEE_OPTIONS}
            placeholder="Select a committee (optional)"
            value={values.committee}
            onChange={(event) => updateField("committee", event.target.value)}
          />
        </FormSection>

        <FormSection
          title="Graduation"
          description="Helps cohort planning and alumni transitions."
        >
          <Select
            label={
              <>
                Graduation year <RequiredMark />
              </>
            }
            name="graduationYear"
            options={GRADUATION_YEAR_OPTIONS}
            placeholder="Select a year"
            value={values.graduationYear}
            error={errors.graduationYear}
            onChange={(event) =>
              updateField("graduationYear", event.target.value)
            }
            onBlur={() => handleBlur("graduationYear")}
            required
          />
        </FormSection>

        <FormSection
          title="Contact"
          description="Where the invitation and follow-ups will go."
        >
          <div className="members-invite-stack">
            <Input
              label={
                <>
                  Email address <RequiredMark />
                </>
              }
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              error={errors.email}
              onChange={(event) => updateField("email", event.target.value)}
              onBlur={() => handleBlur("email")}
              placeholder="name@semo.edu"
              required
            />
            <Input
              label="Phone number"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={values.phone}
              error={errors.phone}
              hint="Optional. Use a 10-digit mobile number when possible."
              onChange={(event) => updateField("phone", event.target.value)}
              onBlur={() => handleBlur("phone")}
              placeholder="(555) 555-5555"
            />
          </div>
        </FormSection>
      </form>
    </Drawer>
  );
}
