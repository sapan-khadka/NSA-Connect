import { isAxiosError } from "axios";

import type { MemberRole } from "./roles";

import api from "./api";
import { normalizeSemoEmail, normalizeStudentId } from "./validation";

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
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

export type MemberResponse = {
  id: number;
  full_name: string;
  email: string;
  student_id: string;
  major: string;
  graduation_year: number;
  role: MemberRole;
  status: string;
};

export async function fetchCurrentMember(): Promise<MemberResponse> {
  const response = await api.get<MemberResponse>("/v1/auth/me");
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

export function getApiErrorMessage(error: unknown): string {
  if (isPendingApprovalError(error)) {
    return "";
  }

  if (!isAxiosError(error)) {
    return "Something went wrong. Please try again.";
  }

  if (!error.response) {
    return "Cannot reach the server. Make sure the backend is running on port 8000.";
  }

  if (error.response.status === 502 || error.response.status === 503) {
    return "Cannot reach the server. Make sure the backend is running on port 8000.";
  }

  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String(item.msg);
        }

        return "Invalid input";
      })
      .join(" ");
  }

  return "Something went wrong. Please try again.";
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
