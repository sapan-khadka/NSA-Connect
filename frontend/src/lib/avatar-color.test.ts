import { describe, expect, it } from "vitest";

import {
  avatarColorForPerson,
  avatarColorFromSeed,
  personAvatarSeed,
} from "./avatar-color";

describe("avatar-color", () => {
  it("is stable for the same seed", () => {
    const a = avatarColorFromSeed("member:7");
    const b = avatarColorFromSeed("member:7");
    expect(a).toEqual(b);
  });

  it("prefers member id over display name so chat and Home match", () => {
    expect(personAvatarSeed(42, "Mukesh Mahato")).toBe("member:42");
    expect(personAvatarSeed(null, "Mukesh Mahato")).toBe("name:mukesh mahato");
    const byId = avatarColorForPerson(42, "Mukesh Mahato");
    const byIdOnly = avatarColorForPerson(42, "Someone Else");
    expect(byId).toEqual(byIdOnly);
  });

  it("does not use the old user: id prefix path for people", () => {
    const memberSeed = personAvatarSeed(5, "Ada");
    expect(memberSeed).toBe("member:5");
    expect(memberSeed).not.toContain("user:");
  });
});
