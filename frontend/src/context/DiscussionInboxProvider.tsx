import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  fetchDiscussionInbox,
  type DiscussionArchivedRoom,
  type DiscussionInboxRoom,
} from "../lib/discussion-api";
import { sortDiscussionInboxRooms } from "../lib/discussion-inbox";
import { useAuth } from "./useAuth";

const INBOX_POLL_MS = 15_000;

type DiscussionInboxContextValue = {
  rooms: DiscussionInboxRoom[];
  archivedRooms: DiscussionArchivedRoom[];
  personalArchivedRooms: DiscussionInboxRoom[];
  loading: boolean;
  error: string | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setRooms: Dispatch<SetStateAction<DiscussionInboxRoom[]>>;
  setArchivedRooms: Dispatch<SetStateAction<DiscussionArchivedRoom[]>>;
  setPersonalArchivedRooms: Dispatch<SetStateAction<DiscussionInboxRoom[]>>;
  subscribe: () => () => void;
};

const DiscussionInboxContext = createContext<DiscussionInboxContextValue | null>(
  null,
);

const EMPTY_INBOX_VALUE: DiscussionInboxContextValue = {
  rooms: [],
  archivedRooms: [],
  personalArchivedRooms: [],
  loading: false,
  error: null,
  refresh: async () => undefined,
  setRooms: () => undefined,
  setArchivedRooms: () => undefined,
  setPersonalArchivedRooms: () => undefined,
  subscribe: () => () => undefined,
};

export function DiscussionInboxProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [archivedRooms, setArchivedRooms] = useState<DiscussionArchivedRoom[]>(
    [],
  );
  const [personalArchivedRooms, setPersonalArchivedRooms] = useState<
    DiscussionInboxRoom[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const subscriberCountRef = useRef(0);
  const roomsLengthRef = useRef(0);
  roomsLengthRef.current = rooms.length;
  const inflightRef = useRef<Promise<void> | null>(null);

  const applyEmpty = useCallback(() => {
    setRooms([]);
    setArchivedRooms([]);
    setPersonalArchivedRooms([]);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAuthenticated) {
        applyEmpty();
        return;
      }

      const silent = opts?.silent ?? roomsLengthRef.current > 0;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      if (inflightRef.current) {
        await inflightRef.current;
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      const run = (async () => {
        try {
          const response = await fetchDiscussionInbox();
          setRooms(sortDiscussionInboxRooms(response.rooms));
          setArchivedRooms(response.archived_rooms ?? []);
          setPersonalArchivedRooms(
            sortDiscussionInboxRooms(response.personal_archived_rooms ?? []),
          );
          setError(null);
        } catch {
          if (!silent) {
            setRooms([]);
            setArchivedRooms([]);
            setPersonalArchivedRooms([]);
            setError("Could not load discussions.");
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
          inflightRef.current = null;
        }
      })();

      inflightRef.current = run;
      await run;
    },
    [applyEmpty, isAuthenticated],
  );

  const subscribe = useCallback(() => {
    subscriberCountRef.current += 1;
    if (subscriberCountRef.current === 1) {
      setActive(true);
    }
    return () => {
      subscriberCountRef.current = Math.max(0, subscriberCountRef.current - 1);
      if (subscriberCountRef.current === 0) {
        setActive(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      applyEmpty();
      return;
    }
    if (!active) {
      return;
    }

    let cancelled = false;

    void refresh({ silent: roomsLengthRef.current > 0 });

    const pollId = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void refresh({ silent: true });
    }, INBOX_POLL_MS);

    function handleWake() {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
    };
  }, [active, applyEmpty, isAuthenticated, refresh]);

  const value = useMemo(
    () => ({
      rooms,
      archivedRooms,
      personalArchivedRooms,
      loading,
      error,
      refresh,
      setRooms,
      setArchivedRooms,
      setPersonalArchivedRooms,
      subscribe,
    }),
    [
      archivedRooms,
      error,
      loading,
      personalArchivedRooms,
      refresh,
      rooms,
      subscribe,
    ],
  );

  return (
    <DiscussionInboxContext.Provider value={value}>
      {children}
    </DiscussionInboxContext.Provider>
  );
}

export function useDiscussionInbox(options?: { enabled?: boolean }) {
  const value = useContext(DiscussionInboxContext) ?? EMPTY_INBOX_VALUE;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return value.subscribe();
  }, [enabled, value.subscribe]);

  return value;
}
