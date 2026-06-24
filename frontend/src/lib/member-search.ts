import type { MemberResponse } from "./auth-api";

export function memberMatchesSearch(
  member: MemberResponse,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    member.full_name,
    member.email,
    member.student_id,
    member.major,
    member.role,
    member.status,
    String(member.graduation_year),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}
