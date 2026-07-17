import { useState, type FormEvent } from "react";

import { useAuth } from "../context/useAuth";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { getApiErrorMessage } from "../lib/api-error";
import { changeMyPassword } from "../lib/members-api";
import { getPasswordHint, validatePasswordStrength } from "../lib/password-validation";
import {
  validateLoginPassword,
} from "../lib/validation";

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
    <Card
      as="form"
      onSubmit={(event) => void handleSubmit(event)}
      padding="md"
    >
      <h2 className="text-lg font-light tracking-subhead text-foreground">Change password</h2>
      <p className="mt-1 text-sm text-label">
        {getPasswordHint()} You will stay signed in on this device; other
        sessions will be signed out.
      </p>

      {serverError ? (
        <div className="mt-4 ds-alert-banner">
          {serverError}
        </div>
      ) : null}

      {successMessage ? (
        <Card
          as="div"
          padding="none"
          className="mt-4 px-4 py-3 text-sm text-primary"
        >
          {successMessage}
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
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
        </div>

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

      <div className="mt-8 flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Update password
        </Button>
      </div>
    </Card>
  );
}
