import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import { changeMyPassword } from "../lib/members-api";
import {
  validateLoginPassword,
  validateRegisterPassword,
} from "../lib/validation";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type PasswordFormErrors = {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
};

export function ChangePasswordForm() {
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
    const newError = validateRegisterPassword(newPassword);

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
      await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
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
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-primary">Change password</h2>
      <p className="mt-1 text-sm text-gray-500">
        Use at least 8 characters. You will stay signed in after updating your
        password.
      </p>

      {serverError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="current_password"
            className="block text-sm font-medium text-gray-700"
          >
            Current password
          </label>
          <input
            id="current_password"
            name="current_password"
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
            className={inputClassName}
          />
          {fieldErrors.current_password ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.current_password}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="new_password"
            className="block text-sm font-medium text-gray-700"
          >
            New password
          </label>
          <input
            id="new_password"
            name="new_password"
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
            className={inputClassName}
          />
          {fieldErrors.new_password ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.new_password}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="confirm_password"
            className="block text-sm font-medium text-gray-700"
          >
            Confirm new password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
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
            className={inputClassName}
          />
          {fieldErrors.confirm_password ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.confirm_password}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
