/**
 * Invite Member side drawer — UX / validation only. No backend calls.
 */

import { useEffect, useState, type ReactNode } from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { Input } from "../design-system/components/Input";
import { Select } from "../design-system/components/Select";
import { MEMBER_ROLES } from "../lib/roles";
import { Button } from "./ui/Button";

const DRAFT_STORAGE_KEY = "nsa-connect.invite-member.draft";

type InviteFormValues = {
  firstName: string;
  lastName: string;
  role: string;
  committee: string;
  email: string;
  phone: string;
  graduationYear: string;
};

type InviteFormErrors = Partial<Record<keyof InviteFormValues, string>>;

const EMPTY_FORM: InviteFormValues = {
  firstName: "",
  lastName: "",
  role: "",
  committee: "",
  email: "",
  phone: "",
  graduationYear: "",
};

const ROLE_OPTIONS = MEMBER_ROLES.map((role) => ({
  value: role,
  label: role.charAt(0).toUpperCase() + role.slice(1),
}));

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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 || digits.length >= 10;
}

function validateInviteForm(values: InviteFormValues): InviteFormErrors {
  const errors: InviteFormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required.";
  }
  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }
  if (!values.role) {
    errors.role = "Choose a role for this invitation.";
  }
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = "Enter a phone number with at least 10 digits.";
  }
  if (!values.graduationYear) {
    errors.graduationYear = "Select an expected graduation year.";
  }

  return errors;
}

function loadDraft(): InviteFormValues | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<InviteFormValues>;
    return { ...EMPTY_FORM, ...parsed };
  } catch {
    return null;
  }
}

function saveDraft(values: InviteFormValues): void {
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
}

function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="members-invite-section">
      <div className="members-invite-section-header">
        <h3 className="members-invite-section-title">{title}</h3>
        {description ? (
          <p className="members-invite-section-desc">{description}</p>
        ) : null}
      </div>
      <div className="members-invite-section-body">{children}</div>
    </section>
  );
}

export function InviteMemberDrawer({ open, onClose }: InviteMemberDrawerProps) {
  const [values, setValues] = useState<InviteFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const draft = loadDraft();
    setValues(draft ?? EMPTY_FORM);
    setErrors({});
    setDraftSaved(false);
  }, [open]);

  function updateField<K extends keyof InviteFormValues>(
    key: K,
    next: InviteFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: next }));
    setDraftSaved(false);
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  }

  function handleCancel() {
    setErrors({});
    onClose();
  }

  function handleSaveDraft() {
    saveDraft(values);
    setDraftSaved(true);
  }

  function handleInvite() {
    const nextErrors = validateInviteForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // No backend invite endpoint wired — keep the invitation local-only for now.
    clearDraft();
    setDraftSaved(false);
    setValues(EMPTY_FORM);
    onClose();
  }

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
        <>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
          >
            Save Draft
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleInvite}>
            Invite
          </Button>
        </>
      }
    >
      <div className="members-invite-form">
        {draftSaved ? (
          <p className="members-invite-banner is-success" role="status">
            Draft saved on this device.
          </p>
        ) : null}
        {Object.keys(errors).length > 0 ? (
          <p className="members-invite-banner is-error" role="alert">
            Fix the highlighted fields before sending the invite.
          </p>
        ) : null}

        <FormSection
          title="Personal Information"
          description="How this member will appear across CampusOS."
        >
          <div className="members-invite-grid">
            <Input
              label="First name"
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              error={errors.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              placeholder="Alex"
            />
            <Input
              label="Last name"
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              error={errors.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              placeholder="Member"
            />
          </div>
        </FormSection>

        <FormSection
          title="Role"
          description="Controls access level after they accept."
        >
          <Select
            label="Member role"
            name="role"
            options={ROLE_OPTIONS}
            placeholder="Select a role"
            value={values.role}
            error={errors.role}
            onChange={(event) => updateField("role", event.target.value)}
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

        <FormSection title="Email" description="Invitation will be sent here.">
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            error={errors.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@semo.edu"
          />
        </FormSection>

        <FormSection title="Phone" description="Optional contact number.">
          <Input
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={values.phone}
            error={errors.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="(555) 555-5555"
          />
        </FormSection>

        <FormSection
          title="Expected Graduation"
          description="Helps cohort planning and alumni transitions."
        >
          <Select
            label="Graduation year"
            name="graduationYear"
            options={GRADUATION_YEAR_OPTIONS}
            placeholder="Select a year"
            value={values.graduationYear}
            error={errors.graduationYear}
            onChange={(event) =>
              updateField("graduationYear", event.target.value)
            }
          />
        </FormSection>
      </div>
    </Drawer>
  );
}
