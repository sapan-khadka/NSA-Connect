import { describe, expect, it } from "vitest";

import {
  memberMatchesMajors,
  normalizeMajor,
  uniqueNormalizedMajors,
} from "./member-majors";

describe("member-majors", () => {
  it("normalizes casing and safe CS alias", () => {
    expect(normalizeMajor("nursing")).toBe("Nursing");
    expect(normalizeMajor("Nursing")).toBe("Nursing");
    expect(normalizeMajor("CS")).toBe("Computer Science");
    expect(normalizeMajor("cs")).toBe("Computer Science");
    expect(normalizeMajor("Computer Science")).toBe("Computer Science");
  });

  it("deduplicates facet majors", () => {
    expect(
      uniqueNormalizedMajors([
        "CS",
        "Computer Science",
        "nursing",
        "Nursing",
        "Administration",
      ]),
    ).toEqual(["Administration", "Computer Science", "Nursing"]);
  });

  it("matches members by normalized major", () => {
    expect(
      memberMatchesMajors({ major: "CS" }, ["Computer Science"]),
    ).toBe(true);
    expect(memberMatchesMajors({ major: "nursing" }, ["Nursing"])).toBe(true);
    expect(memberMatchesMajors({ major: "Biology" }, ["Nursing"])).toBe(false);
  });
});
