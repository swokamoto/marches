import { describe, it, expect } from "vitest";
import { slugify } from "./slugify.js";

describe("slugify", () => {
  it("lowercases the input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("the lost city")).toBe("the-lost-city");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("too  many   spaces")).toBe("too-many-spaces");
  });

  it("collapses multiple hyphens into one", () => {
    expect(slugify("a--b---c")).toBe("a-b-c");
  });

  it("strips special characters", () => {
    expect(slugify("Château d'Amboise!")).toBe("chteau-damboise");
  });

  it("strips leading and trailing hyphens/spaces", () => {
    expect(slugify("  leading and trailing  ")).toBe("leading-and-trailing");
  });

  it("allows alphanumeric characters and hyphens", () => {
    expect(slugify("area-51 zone 9")).toBe("area-51-zone-9");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(80);
    expect(slugify(long)).toHaveLength(60);
  });

  it("returns an empty string for an empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("returns an empty string when all characters are stripped", () => {
    expect(slugify("!!!###$$$")).toBe("");
  });
});
