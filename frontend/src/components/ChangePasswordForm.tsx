import { useState, type FormEvent } from "react";

import { useAuth } from "../context/useAuth";
import { Input } from "./ui/Input";
import { getApiErrorMessage } from "../lib/api-error";
import { changeMyPassword } from "../lib/members-api";
import { getPasswordHint, validatePasswordStrength } from "../lib/password-validation";
import { validateLoginPassword } from "../lib/validation";

type PasswordFormErrors = {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
};

type ChangePasswordFormProps = {
  email?: string;
  fullName?: string;
};

export function ChangePasswordForm({ email, fullName }: ChangePasswordFormProps) {
  const { updateSessionTokens } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): PasswordFormErrors {
    const errors: PasswordFormErrors = {};
    const currentError = validateLoginPassword(currentPassword);
    const newError = validatePasswordStrength(newPassword, {
      email,
      fullName,
    });

    if (currentError) {
      errors.current_password = currentError;
    }

    if (newError) {
      errors.new_password = newError;
    } else if (newPassword === currentPassword) {
      errors.new_password = "New password must be different from your current password";
    }

    if (!confirmPassword) {
      errors.confirm_password = "Please confirm your new password";
    } else if (confirmPassword !== newPassword) {
      errors.confirm_password = "Passwords do not match";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const tokens = await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      updateSessionTokens(tokens);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Password updated successfully.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="settings-block is-flush"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {serverError ? (
        <p className="settings-status is-error" role="alert">
          {serverError}
        </p>
      ) : null}

      {successMessage ? (
        <p className="settings-status" role="status">
          {successMessage}
        </p>
      ) : null}

      <h2 className="event-command-kicker">Password</h2>
      <div className="settings-stack">
        <Input
          id="current_password"
          name="current_password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setFieldErrors((current) => ({
              ...current,
              current_password: undefined,
            }));
            setServerError(null);
            setSuccessMessage(null);
          }}
          error={fieldErrors.current_password}
        />
        <Input
          id="new_password"
          name="new_password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setFieldErrors((current) => ({
              ...current,
              new_password: undefined,
            }));
            setServerError(null);
            setSuccessMessage(null);
          }}
          error={fieldErrors.new_password}
          hint={
            newPassword ? `${newPassword.length} characters` : getPasswordHint()
          }
        />
        <Input
          id="confirm_password"
          name="confirm_password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFieldErrors((current) => ({
              ...current,
              confirm_password: undefined,
            }));
            setServerError(null);
            setSuccessMessage(null);
          }}
          error={fieldErrors.confirm_password}
        />
      </div>

      <p className="settings-muted">Other sessions will be signed out.</p>

      <div className="settings-actions">
        <button
          type="submit"
          disabled={isSubmitting}
          className="event-command-btn event-command-btn--primary"
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
