import { isAxiosError } from "axios";

import type { MemberPosition, MemberRole } from "./roles";
import type { MemberTalent, ProfileFieldVisibility } from "./member-talents";

import api from "./api";
import { normalizeSemoEmail, normalizeStudentId } from "./validation";

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  refresh_expires_at: string;
};

export async function loginMember(data: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/v1/auth/login", {
    email: normalizeSemoEmail(data.email),
    password: data.password,
  });

  return response.data;
}

export type RegisterRequest = {
  full_name: string;
  email: string;
  password: string;
  student_id: string;
  major: string;
  graduation_year: number;
};

export type CustomBoardPositionSummary = {
  id: number;
  name: string;
  is_active: boolean;
};

export type MemberResponse = {
  id: number;
  full_name: string;
  email: string | null;
  student_id: string | null;
  major: string;
  graduation_year: number;
  role: MemberRole;
  status: string;
  position: MemberPosition;
  custom_board_position?: CustomBoardPositionSummary | null;
  interests?: string | null;
  bio?: string | null;
  talents?: MemberTalent[] | string[];
  talent_other?: string | null;
  phone?: string | null;
  social_handle?: string | null;
  email_visibility?: ProfileFieldVisibility;
  phone_visibility?: ProfileFieldVisibility;
  social_handle_visibility?: ProfileFieldVisibility;
};

export async function fetchCurrentMember(): Promise<MemberResponse> {
  const response = await api.get<MemberResponse>("/v1/auth/me");
  return response.data;
}

export type PasswordResetRequestResponse = {
  message: string;
};

export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResponse> {
  const response = await api.post<PasswordResetRequestResponse>(
    "/v1/auth/password-reset/request",
    { email: normalizeSemoEmail(email) },
  );
  return response.data;
}

export type PasswordResetConfirmRequest = {
  token: string;
  new_password: string;
};

export async function confirmPasswordReset(
  data: PasswordResetConfirmRequest,
): Promise<PasswordResetRequestResponse> {
  const response = await api.post<PasswordResetRequestResponse>(
    "/v1/auth/password-reset/confirm",
    data,
  );
  return response.data;
}

export async function registerMember(data: RegisterRequest): Promise<MemberResponse> {
  const response = await api.post<MemberResponse>("/v1/auth/register", {
    full_name: data.full_name.trim(),
    email: normalizeSemoEmail(data.email),
    password: data.password,
    student_id: normalizeStudentId(data.student_id),
    major: data.major.trim(),
    graduation_year: data.graduation_year,
  });

  return response.data;
}

const PENDING_APPROVAL_DETAIL = "Member account is not approved";

export function isPendingApprovalError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  return (
    error.response?.status === 403 &&
    error.response?.data?.detail === PENDING_APPROVAL_DETAIL
  );
}
