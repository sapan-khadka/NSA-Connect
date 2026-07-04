export const MEMBER_TALENTS = [
  "dancing",
  "singing",
  "instruments",
  "acting_drama",
  "hosting_mc",
  "poetry_writing",
  "cooking",
  "photography_videography",
  "decoration_art",
  "modeling",
  "other",
] as const;

export type MemberTalent = (typeof MEMBER_TALENTS)[number];

export const MEMBER_TALENT_LABELS: Record<MemberTalent, string> = {
  dancing: "Dancing",
  singing: "Singing",
  instruments: "Instruments (Madal/Tabla/etc.)",
  acting_drama: "Acting/Drama",
  hosting_mc: "Hosting/MC",
  poetry_writing: "Poetry/Writing",
  cooking: "Cooking",
  photography_videography: "Photography/Videography",
  decoration_art: "Decoration/Art",
  modeling: "Modeling",
  other: "Other",
};

export type ProfileFieldVisibility = "public" | "board_only";

export function formatTalentLabel(talent: string, talentOther?: string | null): string {
  if (talent === "other" && talentOther) {
    return talentOther;
  }
  if (talent in MEMBER_TALENT_LABELS) {
    return MEMBER_TALENT_LABELS[talent as MemberTalent];
  }
  return talent;
}

export function formatTalentFilterSummary(
  selectedTalents: string[],
  count: number,
): string {
  if (selectedTalents.length === 0) {
    return "";
  }
  if (selectedTalents.length === 1) {
    const label = formatTalentLabel(selectedTalents[0]).toLowerCase();
    return `Showing ${count} member${count === 1 ? "" : "s"} who can ${label}`;
  }
  return `Showing ${count} member${count === 1 ? "" : "s"} with selected talents (any match)`;
}

export function getMemberInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function buildMemberContactLine(member: {
  email?: string | null;
  phone?: string | null;
  social_handle?: string | null;
}): string | null {
  const parts = [member.email, member.phone, member.social_handle].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
