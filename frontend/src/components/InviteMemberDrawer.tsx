/**
 * Invite Member — board-facing account invitation drawer.
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
import { getApiErrorMessage } from "../lib/api-error";
import {
  inviteMember,
  type InviteMemberResponse,
} from "../lib/members-api";
import { Button } from "./ui/Button";

const currentYear = new Date().getFullYear();
const GRADUATION_YEAR_OPTIONS = Array.from(
  { length: 9 },
  (_, index) => currentYear + index,
).map((year) => ({ value: String(year), label: String(year) }));

type InviteMemberDrawerProps = {
  open: boolean;
  onClose: () => void;
  onInvited: (result: InviteMemberResponse) => void;
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

export function InviteMemberDrawer({
  open,
  onClose,
  onInvited,
}: InviteMemberDrawerProps) {
  const [values, setValues] = useState<InviteFormValues>(EMPTY_INVITE_FORM);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof InviteFormValues, boolean>>
  >({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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
    setIsSubmitting(false);
    setServerError(null);
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

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setAttemptedSubmit(true);
    setServerError(null);
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

    setIsSubmitting(true);
    try {
      const result = await inviteMember({
        full_name: `${values.firstName.trim()} ${values.lastName.trim()}`,
        email: values.email.trim().toLowerCase(),
        student_id: values.studentId.trim().toUpperCase(),
        major: values.major.trim(),
        graduation_year: Number(values.graduationYear),
        phone: values.phone.trim() || null,
      });
      clearInviteDraft();
      setDraftSaved(false);
      setValues(EMPTY_INVITE_FORM);
      setTouched({});
      setAttemptedSubmit(false);
      onInvited(result);
      onClose();
    } catch (caught) {
      setServerError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => formRef.current?.requestSubmit()}
              loading={isSubmitting}
              disabled={isSubmitting}
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
        {serverError ? (
          <p className="members-invite-banner is-error" role="alert">
            {serverError}
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
          title="Membership"
          description="University details used to create the member account."
        >
          <div className="members-invite-stack">
            <Input
              label={
                <>
                  Student ID <RequiredMark />
                </>
              }
              name="studentId"
              value={values.studentId}
              error={errors.studentId}
              onChange={(event) => updateField("studentId", event.target.value)}
              onBlur={() => handleBlur("studentId")}
              placeholder="S12345678"
              required
              maxLength={20}
            />
            <Input
              label={
                <>
                  Major <RequiredMark />
                </>
              }
              name="major"
              value={values.major}
              error={errors.major}
              onChange={(event) => updateField("major", event.target.value)}
              onBlur={() => handleBlur("major")}
              placeholder="Computer Science"
              required
              maxLength={255}
            />
          </div>
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
