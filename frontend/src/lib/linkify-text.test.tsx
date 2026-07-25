import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { linkifyText } from "./linkify-text";

describe("linkifyText", () => {
  it("returns plain text when there are no URLs", () => {
    expect(linkifyText("hello world")).toEqual(["hello world"]);
  });

  it("turns https URLs into safe external anchors", () => {
    const nodes = linkifyText("See https://example.com/path for details");
    const { container } = render(<>{nodes}</>);
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "https://example.com/path");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.textContent).toContain("See ");
    expect(container.textContent).toContain(" for details");
  });

  it("prefixes www. links with https", () => {
    const nodes = linkifyText("www.nsa.edu");
    const { container } = render(<>{nodes}</>);
    expect(container.querySelector("a")).toHaveAttribute(
      "href",
      "https://www.nsa.edu/",
    );
  });

  it("does not linkify javascript: or data: schemes", () => {
    const nodes = linkifyText(
      'bad javascript:alert(1) and data:text/html,hi and https://ok.example',
    );
    const { container } = render(<>{nodes}</>);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["https://ok.example/"]);
    expect(container.textContent).toContain("javascript:alert(1)");
  });
});
