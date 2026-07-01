const SINK_DURATION_MS = 1500;
const STAGGER_MS = 120;
const HORIZONTAL_OFFSET_PX = 20;

export function getNotGoingCryCount(random = Math.random): 2 | 3 {
  return random() < 0.5 ? 2 : 3;
}

function reactionHost(anchor: HTMLElement): HTMLElement {
  return anchor.closest("[data-rsvp-reaction-host]") ?? anchor;
}

function spawnEmoji(
  anchor: HTMLElement,
  emoji: string,
  className: string,
): HTMLSpanElement {
  const el = document.createElement("span");
  el.textContent = emoji;
  el.className = `rsvp-reaction-emoji ${className}`;
  el.setAttribute("aria-hidden", "true");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  reactionHost(anchor).appendChild(el);
  return el;
}

/** Celebration burst for "Going" — unchanged from the original single-option reactions. */
export function playGoingBurst(anchor: HTMLElement): void {
  const emojis = ["🎉", "🥳", "✨"] as const;
  const offsets = [
    { x: "-24px", y: "-38px" },
    { x: "0px", y: "-46px" },
    { x: "24px", y: "-34px" },
  ];

  emojis.forEach((emoji, index) => {
    const el = spawnEmoji(anchor, emoji, "rsvp-reaction-burst");
    el.style.setProperty("--rsvp-x", offsets[index].x);
    el.style.setProperty("--rsvp-y", offsets[index].y);
    el.style.animationDelay = `${index * 70}ms`;
  });
}

/** Single wobbling emoji for "Maybe" — unchanged from the original single-option reactions. */
export function playMaybeWobble(anchor: HTMLElement): void {
  spawnEmoji(anchor, "😕", "rsvp-reaction-wobble");
}

/** Multiple sinking crying emojis for "Not going" (2–3, staggered). */
export function playNotGoingCries(
  anchor: HTMLElement,
  random = Math.random,
): void {
  const count = getNotGoingCryCount(random);
  const offsets =
    count === 2
      ? [-HORIZONTAL_OFFSET_PX, HORIZONTAL_OFFSET_PX]
      : [-HORIZONTAL_OFFSET_PX, 0, HORIZONTAL_OFFSET_PX];

  offsets.forEach((offset, index) => {
    const el = spawnEmoji(anchor, "😢", "rsvp-reaction-cry-sink");
    el.style.setProperty("--rsvp-x", `${offset}px`);
    el.style.animationDelay = `${index * STAGGER_MS}ms`;
    el.style.animationDuration = `${SINK_DURATION_MS}ms`;
  });
}
