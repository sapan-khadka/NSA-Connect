import { afterEach, describe, expect, it } from "vitest";

import {
  getNotGoingCryCount,
  playGoingBurst,
  playMaybeWobble,
  playNotGoingCries,
} from "./rsvp-reactions";

function createAnchor(): HTMLButtonElement {
  const host = document.createElement("div");
  host.setAttribute("data-rsvp-reaction-host", "");
  host.style.position = "relative";
  const button = document.createElement("button");
  host.appendChild(button);
  document.body.appendChild(host);
  return button;
}

describe("rsvp-reactions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("spawns three celebration emojis for going", () => {
    const anchor = createAnchor();
    playGoingBurst(anchor);

    const emojis = anchor.parentElement?.querySelectorAll(".rsvp-reaction-burst");
    expect(emojis).toHaveLength(3);
    expect(Array.from(emojis ?? []).map((node) => node.textContent)).toEqual([
      "🎉",
      "🥳",
      "✨",
    ]);
  });

  it("spawns one wobbling emoji for maybe", () => {
    const anchor = createAnchor();
    playMaybeWobble(anchor);

    const emojis = anchor.parentElement?.querySelectorAll(".rsvp-reaction-wobble");
    expect(emojis).toHaveLength(1);
    expect(emojis?.[0]?.textContent).toBe("😕");
  });

  it("spawns two crying emojis when random is below 0.5", () => {
    const anchor = createAnchor();
    playNotGoingCries(anchor, () => 0.2);

    const emojis = anchor.parentElement?.querySelectorAll(".rsvp-reaction-cry-sink");
    expect(emojis).toHaveLength(2);
    expect(Array.from(emojis ?? []).every((node) => node.textContent === "😢")).toBe(
      true,
    );
  });

  it("spawns three crying emojis with staggered delays when random is above 0.5", () => {
    const anchor = createAnchor();
    playNotGoingCries(anchor, () => 0.8);

    const emojis = Array.from(
      anchor.parentElement?.querySelectorAll(".rsvp-reaction-cry-sink") ?? [],
    );
    expect(emojis).toHaveLength(3);
    expect(emojis[0]?.style.getPropertyValue("--rsvp-x")).toBe("-20px");
    expect(emojis[1]?.style.getPropertyValue("--rsvp-x")).toBe("0px");
    expect(emojis[2]?.style.getPropertyValue("--rsvp-x")).toBe("20px");
    expect(emojis[0]?.style.animationDelay).toBe("0ms");
    expect(emojis[1]?.style.animationDelay).toBe("120ms");
    expect(emojis[2]?.style.animationDelay).toBe("240ms");
  });

  it("randomizes not-going cry count between two and three", () => {
    expect(getNotGoingCryCount(() => 0)).toBe(2);
    expect(getNotGoingCryCount(() => 0.49)).toBe(2);
    expect(getNotGoingCryCount(() => 0.5)).toBe(3);
    expect(getNotGoingCryCount(() => 0.99)).toBe(3);
  });
});
