"use client";

/**
 * useHotTicketSocket
 * ----------------------------------------------------------------------------
 * Connects to the NavbatCore realtime gateway over Socket.IO and subscribes
 * to mutations for a specific (clinicId, ticketId). The gateway authenticates
 * the connection, validates Zod payloads, and broadcasts decoded
 * `RealtimeTicketEvent`s on per-ticket rooms.
 *
 * Returned state:
 *   * status        — connection lifecycle for the UI status pill.
 *   * lastEvent     — most recent event for animations / log lines.
 *   * snapshot      — denormalized live snapshot the card renders directly.
 *   * latencyMs     — RTT measured on the most recent ping.
 *
 * Reconnection: the underlying Socket.IO client handles backoff. We surface
 * the lifecycle so the Liquid Glass UI can fade between states instead of
 * flashing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import {
  type RealtimeTicketEvent,
  RealtimeTicketEventSchema,
} from "@/schemas/ticket";

export type TicketSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface LiveTicketSnapshot {
  ticketId: string;
  clinicId: string;
  ticketCode: string;
  status: RealtimeTicketEvent extends { status: infer S } ? S : string;
  etaAt: string | null;
  etaConfidence: number | null;
  scheduledFor: string;
  positionInDay: number;
  /** Server-side wall-clock ts of the last applied event (ms). */
  lastEventAt: number;
}

export interface UseHotTicketSocketArgs {
  url: string;
  clinicId: string;
  ticketId: string;
  /** Short-lived JWT minted by the API for this patient/staff session. */
  authToken: string;
  initialSnapshot: LiveTicketSnapshot;
}

export interface UseHotTicketSocketResult {
  status: TicketSocketStatus;
  snapshot: LiveTicketSnapshot;
  lastEvent: RealtimeTicketEvent | null;
  latencyMs: number | null;
  reconnect: () => void;
}

export const useHotTicketSocket = ({
  url,
  clinicId,
  ticketId,
  authToken,
  initialSnapshot,
}: UseHotTicketSocketArgs): UseHotTicketSocketResult => {
  const [status, setStatus] = useState<TicketSocketStatus>("idle");
  const [snapshot, setSnapshot] = useState<LiveTicketSnapshot>(initialSnapshot);
  const [lastEvent, setLastEvent] = useState<RealtimeTicketEvent | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const reconnectKey = useRef(0);

  // Keep the latest snapshot in a ref so event handlers always read the
  // freshest baseline without re-binding listeners on every render.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const reconnect = useMemo(
    () => () => {
      reconnectKey.current += 1;
      socketRef.current?.disconnect();
      socketRef.current?.connect();
    },
    [],
  );

  useEffect(() => {
    setStatus("connecting");

    const socket = io(url, {
      transports: ["websocket"],
      auth: { token: authToken, clinicId, ticketId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 8_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setStatus("connected");
      socket.emit("ticket:subscribe", { clinicId, ticketId });
    };

    const onDisconnect = (reason: Socket.DisconnectReason) => {
      setStatus(reason === "io client disconnect" ? "disconnected" : "reconnecting");
    };

    const onConnectError = () => setStatus("error");
    const onReconnectAttempt = () => setStatus("reconnecting");

    const onTicketEvent = (raw: unknown) => {
      const parsed = RealtimeTicketEventSchema.safeParse(raw);
      if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.warn("[ticket-socket] dropped malformed event", parsed.error.flatten());
        return;
      }
      const event = parsed.data;
      setLastEvent(event);
      setSnapshot((prev) => mergeEventIntoSnapshot(prev, event));
    };

    // RTT probe — server replies on the same `ping:ack` event.
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    const startPings = () => {
      pingTimer = setInterval(() => {
        const sentAt = performance.now();
        socket
          .timeout(4_000)
          .emit("ping:rtt", { sentAt }, (_err: Error | null) => {
            const rtt = performance.now() - sentAt;
            if (Number.isFinite(rtt)) setLatencyMs(Math.round(rtt));
          });
      }, 5_000);
    };

    socket.on("connect", () => {
      onConnect();
      startPings();
    });
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("ticket:event", onTicketEvent);

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // `reconnectKey.current` change is intentionally not a dep — reconnect()
    // tears down the socket itself.
  }, [url, clinicId, ticketId, authToken]);

  return { status, snapshot, lastEvent, latencyMs, reconnect };
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const mergeEventIntoSnapshot = (
  prev: LiveTicketSnapshot,
  event: RealtimeTicketEvent,
): LiveTicketSnapshot => {
  const eventTs =
    event.occurredAt instanceof Date
      ? event.occurredAt.getTime()
      : new Date(event.occurredAt).getTime();

  // Out-of-order delivery guard.
  if (eventTs < prev.lastEventAt) return prev;

  switch (event.type) {
    case "ticket.created":
      if (event.ticketId !== prev.ticketId) return prev;
      return {
        ...prev,
        ticketCode: event.ticketCode,
        status: event.status,
        etaAt: event.etaAt ? new Date(event.etaAt).toISOString() : null,
        scheduledFor: new Date(event.scheduledFor).toISOString(),
        positionInDay: event.positionInDay,
        lastEventAt: eventTs,
      };

    case "ticket.transitioned":
      if (event.ticketId !== prev.ticketId) return prev;
      return {
        ...prev,
        status: event.to,
        etaAt: event.etaAt ? new Date(event.etaAt).toISOString() : null,
        lastEventAt: eventTs,
      };

    case "ticket.eta_updated":
      if (event.ticketId !== prev.ticketId) return prev;
      return {
        ...prev,
        etaAt: event.etaAt ? new Date(event.etaAt).toISOString() : null,
        etaConfidence: event.etaConfidence,
        lastEventAt: eventTs,
      };

    case "ticket.archived":
      if (event.originalTicketId !== prev.ticketId) return prev;
      return { ...prev, lastEventAt: eventTs };

    default:
      return prev;
  }
};
