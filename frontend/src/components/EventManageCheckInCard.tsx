import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchEventCheckInQr,
  regenerateEventCheckInQr,
  type EventCheckInQrResponse,
} from "../lib/event-checkin-api";
import {
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_PRIMARY_BTN_FLEX,
  EVENT_MANAGE_SECONDARY_BTN,
  EVENT_MANAGE_SECONDARY_BTN_FLEX,
} from "../lib/event-manage-ui";
import { HomeCard } from "./ui/HomeCard";

type QrStatus = "loading" | "active" | "inactive" | "error";

type EventManageCheckInCardProps = {
  eventId: number;
  checkedInCount: number;
  /** Optional venue capacity from event details. */
  eventCapacity: number | null;
  /** Going RSVP count — used when event capacity is unset. */
  goingCount: number | null;
  onOpenCheckIn: () => void;
};

function statusBadge(status: QrStatus): { label: string; className: string } {
  if (status === "active") {
    return {
      label: "Active",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
    };
  }
  if (status === "loading") {
    return {
      label: "Checking…",
      className: "bg-gray-100 text-gray-600 ring-gray-200/80",
    };
  }
  if (status === "error") {
    return {
      label: "Unavailable",
      className: "bg-red-50 text-red-700 ring-red-100/80",
    };
  }
  return {
    label: "Not generated",
    className: "bg-amber-50 text-amber-800 ring-amber-100/80",
  };
}

async function downloadQrSvg(eventId: number): Promise<void> {
  const svg = document.getElementById(`manage-checkin-qr-${eventId}`);
  if (!(svg instanceof SVGElement)) {
    return;
  }
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `event-${eventId}-checkin-qr.svg`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function EventManageCheckInCard({
  eventId,
  checkedInCount,
  eventCapacity,
  goingCount,
  onOpenCheckIn,
}: EventManageCheckInCardProps) {
  const [qrStatus, setQrStatus] = useState<QrStatus>("loading");
  const [qrInfo, setQrInfo] = useState<EventCheckInQrResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQrStatus("loading");
    setErrorMessage(null);

    void fetchEventCheckInQr(eventId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setQrInfo(response);
        setQrStatus("active");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setQrInfo(null);
        setQrStatus("inactive");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const usingEventCapacity = eventCapacity !== null && eventCapacity > 0;
  const capacity = usingEventCapacity
    ? eventCapacity
    : goingCount !== null && goingCount > 0
      ? goingCount
      : null;
  const capacityLabel = usingEventCapacity ? "Capacity" : "Expected";
  const capacityHint = usingEventCapacity ? "Event capacity" : "Going RSVPs";

  const progressPercent =
    capacity !== null && capacity > 0
      ? Math.min(100, Math.round((checkedInCount / capacity) * 100))
      : null;
  const badge = statusBadge(qrStatus);

  const hasActiveQr = qrStatus === "active" && Boolean(qrInfo);

  async function handleGenerate(): Promise<void> {
    if (
      hasActiveQr &&
      !window.confirm(
        "Regenerate this QR code? The old link will stop working immediately.",
      )
    ) {
      return;
    }

    setGenerating(true);
    setErrorMessage(null);
    try {
      const response = hasActiveQr
        ? await regenerateEventCheckInQr(eventId)
        : await fetchEventCheckInQr(eventId);
      setQrInfo(response);
      setQrStatus("active");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
      setQrStatus("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setErrorMessage(null);
    try {
      let info = qrInfo;
      if (!info) {
        info = await fetchEventCheckInQr(eventId);
        setQrInfo(info);
        setQrStatus("active");
      }
      // Wait a tick so the hidden QR SVG mounts with the URL.
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      await downloadQrSvg(eventId);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <HomeCard
      padding="sm"
      className={`relative ${EVENT_MANAGE_CARD_CLASS}`}
      aria-label="Check-in"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <h2 className="home-section-title">Check-in</h2>
          <p className="mt-1 text-xs text-gray-500">Door-ready QR and turnout</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badge.className}`}
        >
          QR {badge.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className={EVENT_MANAGE_EYEBROW}>People checked in</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {checkedInCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className={EVENT_MANAGE_EYEBROW}>{capacityLabel}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {capacity === null ? "—" : capacity}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">{capacityHint}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-gray-500">Progress</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {progressPercent === null ? "—" : `${progressPercent}%`}
          </p>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={progressPercent ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Check-in progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${progressPercent ?? 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">
          {capacity === null
            ? "Set capacity in Details, or wait for Going RSVPs."
            : `${checkedInCount} of ${capacity} ${usingEventCapacity ? "capacity" : "expected"}`}
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {/* Off-screen QR for SVG download — same URL source as the check-in panel. */}
      {qrInfo ? (
        <div className="pointer-events-none absolute -left-[9999px] top-0 opacity-0" aria-hidden="true">
          <QRCode
            id={`manage-checkin-qr-${eventId}`}
            value={qrInfo.checkin_url}
            size={240}
          />
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className={EVENT_MANAGE_PRIMARY_BTN_FLEX}
          >
            {generating
              ? hasActiveQr
                ? "Regenerating…"
                : "Generating…"
              : hasActiveQr
                ? "Regenerate QR"
                : "Generate QR"}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading || qrStatus === "loading"}
            className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
          >
            {downloading ? "Downloading…" : "Download QR"}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenCheckIn}
          className={EVENT_MANAGE_SECONDARY_BTN}
        >
          Open Check-in
        </button>
      </div>
    </HomeCard>
  );
}
