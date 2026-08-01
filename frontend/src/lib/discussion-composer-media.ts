/** MIME types to try for MediaRecorder, in preference order. */
const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

export type ComposerGif = {
  id: string;
  previewUrl: string;
  url: string;
};

/** Offline/dev fallback when `VITE_TENOR_API_KEY` is unset or Tenor fails. */
export const CURATED_COMPOSER_GIFS: ComposerGif[] = [
  {
    id: "curated-thumbs-up",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/200.gif",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  },
  {
    id: "curated-clap",
    previewUrl: "https://media.giphy.com/media/7rj2ZgrrXct6A/200.gif",
    url: "https://media.giphy.com/media/7rj2ZgrrXct6A/giphy.gif",
  },
  {
    id: "curated-party",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  },
  {
    id: "curated-heart",
    previewUrl: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  },
  {
    id: "curated-laugh",
    previewUrl: "https://media.giphy.com/media/10JhviFuU2gWD6/200.gif",
    url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
  },
  {
    id: "curated-wow",
    previewUrl: "https://media.giphy.com/media/3o6Zt0hNCfak3QCqsw/200.gif",
    url: "https://media.giphy.com/media/3o6Zt0hNCfak3QCqsw/giphy.gif",
  },
  {
    id: "curated-ok",
    previewUrl: "https://media.giphy.com/media/3o7abldj0b3hzGTuHO/200.gif",
    url: "https://media.giphy.com/media/3o7abldj0b3hzGTuHO/giphy.gif",
  },
  {
    id: "curated-wave",
    previewUrl: "https://media.giphy.com/media/dzaUX7CAG0Ihi/200.gif",
    url: "https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif",
  },
  {
    id: "curated-fire",
    previewUrl: "https://media.giphy.com/media/l41lGvinEgARjB2HC/200.gif",
    url: "https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif",
  },
  {
    id: "curated-thanks",
    previewUrl: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200.gif",
    url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
  },
  {
    id: "curated-yes",
    previewUrl: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200.gif",
    url: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif",
  },
  {
    id: "curated-celebrate",
    previewUrl: "https://media.giphy.com/media/g9582DNuQppxC/200.gif",
    url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
  },
];

export function pickMediaRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean = (mimeType) =>
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(mimeType),
): string | null {
  for (const candidate of AUDIO_MIME_CANDIDATES) {
    if (isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function audioExtensionForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (base === "audio/mp4" || base === "audio/m4a" || base === "audio/x-m4a") {
    return "m4a";
  }
  if (base === "audio/mpeg") {
    return "mp3";
  }
  if (base === "audio/wav" || base === "audio/wave") {
    return "wav";
  }
  return "webm";
}

export function formatRecordingClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type TenorMediaFormat = {
  url?: string;
};

type TenorResult = {
  id?: string;
  media_formats?: {
    tinygif?: TenorMediaFormat;
    nanogif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    gif?: TenorMediaFormat;
  };
};

function mapTenorResults(results: TenorResult[]): ComposerGif[] {
  const gifs: ComposerGif[] = [];
  for (const result of results) {
    const formats = result.media_formats;
    const previewUrl =
      formats?.tinygif?.url ?? formats?.nanogif?.url ?? formats?.gif?.url;
    const url =
      formats?.mediumgif?.url ?? formats?.gif?.url ?? formats?.tinygif?.url;
    if (!result.id || !previewUrl || !url) {
      continue;
    }
    gifs.push({ id: result.id, previewUrl, url });
  }
  return gifs;
}

export async function loadComposerGifs(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ source: "tenor" | "curated"; gifs: ComposerGif[] }> {
  const key = apiKey?.trim();
  if (key) {
    try {
      const endpoint = new URL("https://tenor.googleapis.com/v2/featured");
      endpoint.searchParams.set("key", key);
      endpoint.searchParams.set("limit", "12");
      endpoint.searchParams.set("media_filter", "gif");
      endpoint.searchParams.set("contentfilter", "high");
      const response = await fetchImpl(endpoint.toString());
      if (response.ok) {
        const payload = (await response.json()) as { results?: TenorResult[] };
        const gifs = mapTenorResults(payload.results ?? []);
        if (gifs.length > 0) {
          return { source: "tenor", gifs };
        }
      }
    } catch {
      // Fall through to curated list.
    }
  }
  return { source: "curated", gifs: CURATED_COMPOSER_GIFS };
}
