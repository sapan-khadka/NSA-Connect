/** Curated sticker pack — large emoji stickers (no external CDN required). */

export type DiscussionSticker = {
  id: string;
  emoji: string;
  label: string;
};

export const DISCUSSION_STICKERS: DiscussionSticker[] = [
  { id: "wave", emoji: "👋", label: "Wave" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "party", emoji: "🎉", label: "Party" },
  { id: "heart", emoji: "❤️", label: "Love" },
  { id: "thumb", emoji: "👍", label: "Yes" },
  { id: "clap", emoji: "👏", label: "Clap" },
  { id: "think", emoji: "🤔", label: "Think" },
  { id: "lol", emoji: "😂", label: "LOL" },
  { id: "pray", emoji: "🙏", label: "Thanks" },
  { id: "rocket", emoji: "🚀", label: "Ship it" },
  { id: "ok", emoji: "👌", label: "OK" },
  { id: "star", emoji: "⭐", label: "Star" },
  { id: "tada", emoji: "✨", label: "Sparkle" },
  { id: "check", emoji: "✅", label: "Done" },
  { id: "eyes", emoji: "👀", label: "Looking" },
  { id: "muscle", emoji: "💪", label: "Strong" },
];

export function isStickerOnlyMessage(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  return DISCUSSION_STICKERS.some((sticker) => sticker.emoji === trimmed);
}
