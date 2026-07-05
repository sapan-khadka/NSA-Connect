import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchEventCheckInQr,
  fetchEventCheckIns,
  formatGuestAffiliation,
  regenerateEventCheckInQr,
  type EventCheckInQrResponse,
  type EventCheckInRecord,
} from "../lib/event-checkin-api";
import { formatEventDateTime } from "../lib/format-datetime";

type EventCheckInPanelProps = {
  eventId: number;
  eventName: string;
};

function checkInRowKey(checkin: EventCheckInRecord): string {
  if (checkin.kind === "guest" && checkin.guest_id !== null) {
    return `guest-${checkin.guest_id}`;
  }
  return `member-${checkin.member_id}`;
}

export function EventCheckInPanel({ eventId, eventName }: EventCheckInPanelProps) {
  const [qrInfo, setQrInfo] = useState<EventCheckInQrResponse | null>(null);
  const [checkins, setCheckins] = useState<EventCheckInRecord[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCheckins = useCallback(async () => {
    setLoadingCheckins(true);
    try {
      const response = await fetchEventCheckIns(eventId);
      setCheckins(response.checkins);
    } catch {
      setCheckins([]);
    } finally {
      setLoadingCheckins(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadCheckins();
    const interval = window.setInterval(() => {
      void loadCheckins();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [loadCheckins]);

  async function handleShowQr() {
    setLoadingQr(true);
    setErrorMessage(null);
    try {
      const response = await fetchEventCheckInQr(eventId);
      setQrInfo(response);
      setShowQr(true);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Generate a new QR code? The old link will stop working immediately.",
      )
    ) {
      return;
    }

    setRegenerating(true);
    setErrorMessage(null);
    try {
      const response = await regenerateEventCheckInQr(eventId);
      setQrInfo(response);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setRegenerating(false);
    }
  }

  const memberCount = checkins.filter((checkin) => checkin.kind === "member").length;
  const guestCount = checkins.filter((checkin) => checkin.kind === "guest").length;

  return (
    <section className="ds-card p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Check-in
        </h2>
        <p className="mt-1 text-sm text-label">
          Members and guests scan a QR code to check themselves in for {eventName}.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-4 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleShowQr()}
          disabled={loadingQr}
          className="rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
        >
          {loadingQr ? "Loading QR…" : showQr ? "Refresh QR code" : "Show check-in QR"}
        </button>
        {showQr && qrInfo ? (
          <button
            type="button"
            onClick={() => void handleRegenerate()}
            disabled={regenerating}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-label hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {regenerating ? "Regenerating…" : "Regenerate QR"}
          </button>
        ) : null}
      </div>

      {showQr && qrInfo ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8">
          <QRCode value={qrInfo.checkin_url} size={240} />
          <p className="max-w-md break-all text-center text-xs text-label">
            {qrInfo.checkin_url}
          </p>
          <p className="text-sm text-label">
            Display this on a screen for members and guests to scan with their phone camera.
          </p>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">
            Checked in ({checkins.length}
            {guestCount > 0 ? ` · ${guestCount} guest${guestCount === 1 ? "" : "s"}` : ""})
          </h3>
          <button
            type="button"
            onClick={() => void loadCheckins()}
            disabled={loadingCheckins}
            className="text-sm text-accent hover:underline disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {loadingCheckins && checkins.length === 0 ? (
          <p className="mt-4 text-sm text-label">Loading check-ins…</p>
        ) : checkins.length === 0 ? (
          <p className="mt-4 text-sm text-label">No one has checked in yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {checkins.map((checkin) => {
              const affiliationLabel = formatGuestAffiliation(
                checkin.affiliation_type,
                checkin.related_member_name,
              );

              return (
                <li
                  key={checkInRowKey(checkin)}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {checkin.full_name}
                      </span>
                      {checkin.kind === "guest" ? (
                        <span className="rounded-full bg-label/10 px-2 py-0.5 text-xs font-medium text-label">
                          Guest
                        </span>
                      ) : null}
                    </div>
                    {affiliationLabel ? (
                      <p className="mt-1 text-xs text-label">{affiliationLabel}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-label">
                    {formatEventDateTime(checkin.checked_in_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {memberCount > 0 || guestCount > 0 ? (
          <p className="mt-3 text-xs text-label">
            {memberCount} member{memberCount === 1 ? "" : "s"}
            {guestCount > 0
              ? ` · ${guestCount} guest${guestCount === 1 ? "" : "s"}`
              : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
