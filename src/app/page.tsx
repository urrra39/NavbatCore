/**
 * Demo landing page.
 *
 * This is a Server Component. It builds a realistic, live-looking mock of a
 * patient's flagship "Live Hot Ticket" surface and hands it to the
 * `LiveHotTicketCard` client component, which subscribes to the realtime
 * gateway and animates the millisecond countdown.
 *
 * Why `force-dynamic`?
 *   The mock `scheduledFor` / `etaAt` values are derived from the current
 *   request time so the countdown always lands a few minutes in the future.
 *   We disable the static cache so every request gets a fresh anchor and
 *   the client never hydrates against a stale ISO string.
 *
 * In production this page would be replaced by `/c/[slug]/page.tsx` (clinic
 * portal, SSR for SEO) and `/t/[code]/page.tsx` (patient ticket, SSR for
 * shareable links). The hero shell and the card layout below are reusable
 * for both.
 */

import { LiveHotTicketCard } from "@/components/LiveHotTicketCard";
import { LiquidGlassSurface } from "@/components/glass/LiquidGlassSurface";
import type { LiveTicketSnapshot } from "@/hooks/useHotTicketSocket";
import { TicketStatus } from "@/schemas/ticket";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Mock realtime gateway
// ---------------------------------------------------------------------------
//
// Out of the box the realtime server is not running, so we point at the
// public env URL (default: http://localhost:4001). The card will gracefully
// fall back to the "Reconnecting" pill — which is exactly the behaviour we
// want to demo. The countdown is fully client-side and unaffected.

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001";
const DEMO_AUTH_TOKEN = "demo.jwt.local-development-only";

// ---------------------------------------------------------------------------
// Mock clinic / provider context
// ---------------------------------------------------------------------------

const MOCK_CLINIC = {
  id: "clx0demo000000clinicroot01",
  slug: "tashkent-cardio-center",
  displayName: "Tashkent Cardio Center",
  city: "Tashkent",
  countryCode: "UZ",
  // Liquid Glass theme override — cyan x violet, deep frost.
  theme: { accent: "#3ad6ff", accent2: "#8b5cf6", blur: 48, frost: 0.6 },
} as const;

const MOCK_PROVIDER = {
  id: "clx0demo000000providerdoc1",
  fullName: "Dr. Aziza Karimova",
  specialty: "Pediatric Cardiology",
  avatarInitials: "AK",
} as const;

// ---------------------------------------------------------------------------
// Mock snapshot factory
// ---------------------------------------------------------------------------

const buildSnapshot = (
  overrides: Partial<LiveTicketSnapshot> & Pick<LiveTicketSnapshot, "ticketId" | "ticketCode" | "status" | "positionInDay">,
): LiveTicketSnapshot => {
  const now = Date.now();
  return {
    clinicId: MOCK_CLINIC.id,
    scheduledFor: new Date(now + 9 * 60 * 1000).toISOString(),
    etaAt: new Date(now + 4 * 60 * 1000 + 37_000).toISOString(),
    etaConfidence: 0.86,
    lastEventAt: now,
    ...overrides,
  };
};

const PRIMARY_SNAPSHOT: LiveTicketSnapshot = buildSnapshot({
  ticketId: "clx0demo000000ticketprimary1",
  ticketCode: "A-074",
  status: TicketStatus.CONFIRMED,
  positionInDay: 7,
});

const SECONDARY_SNAPSHOT: LiveTicketSnapshot = buildSnapshot({
  ticketId: "clx0demo000000ticketnowserv1",
  ticketCode: "A-073",
  status: TicketStatus.IN_PROGRESS,
  positionInDay: 6,
  // Already started 1m12s ago — countdown will read negative ("Overdue by ...")
  // which exercises the overflow color path.
  etaAt: new Date(Date.now() - 72_000).toISOString(),
  etaConfidence: 0.92,
});

const TERTIARY_SNAPSHOT: LiveTicketSnapshot = buildSnapshot({
  ticketId: "clx0demo000000ticketupnext01",
  ticketCode: "A-075",
  status: TicketStatus.PENDING,
  positionInDay: 8,
  etaAt: new Date(Date.now() + 12 * 60 * 1000 + 5_400).toISOString(),
  etaConfidence: 0.71,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-12 px-6 py-16 sm:px-10 lg:py-24">
      {/* ---------- Hero ---------- */}
      <section className="flex flex-col gap-5">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Live · {MOCK_CLINIC.displayName}
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Real-time clinic queue infrastructure with{" "}
          <span
            className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent"
            style={{ WebkitTextFillColor: "transparent" }}
          >
            millisecond precision
          </span>
          .
        </h1>

        <p className="max-w-2xl text-pretty text-base text-white/70 sm:text-lg">
          NavbatCore powers multi-tenant clinics with Postgres-backed hot/cold
          ticket pipelines, an autonomous 7-day retention worker, and a Liquid
          Glass UI that animates every queue mutation as it happens.
        </p>
      </section>

      {/* ---------- Provider context strip ---------- */}
      <ProviderStrip />

      {/* ---------- Card grid ---------- */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <SectionLabel
            kicker="Your Ticket"
            title="In Queue"
            subtitle="Confirmed · CONFIRMED → CHECKED_IN allowed"
          />
          <LiveHotTicketCard
            socketUrl={SOCKET_URL}
            authToken={DEMO_AUTH_TOKEN}
            initialSnapshot={PRIMARY_SNAPSHOT}
            theme={MOCK_CLINIC.theme}
          />
        </div>

        <div className="flex flex-col gap-4">
          <SectionLabel
            kicker="Now Serving"
            title="In Progress"
            subtitle="Live overdue countdown · IN_PROGRESS"
          />
          <LiveHotTicketCard
            socketUrl={SOCKET_URL}
            authToken={DEMO_AUTH_TOKEN}
            initialSnapshot={SECONDARY_SNAPSHOT}
            theme={{ accent: "#5eead4", accent2: "#3ad6ff", blur: 44, frost: 0.55 }}
            staffMode
          />
        </div>

        <div className="flex flex-col gap-4">
          <SectionLabel
            kicker="Up Next"
            title="Pending"
            subtitle="Awaiting confirmation · PENDING"
          />
          <LiveHotTicketCard
            socketUrl={SOCKET_URL}
            authToken={DEMO_AUTH_TOKEN}
            initialSnapshot={TERTIARY_SNAPSHOT}
            theme={{ accent: "#ffd166", accent2: "#ff8fa3", blur: 40, frost: 0.5 }}
          />
        </div>
      </section>

      {/* ---------- Architecture footnote ---------- */}
      <ArchitectureFootnote />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ProviderStrip() {
  return (
    <LiquidGlassSurface
      className="px-6 py-5 sm:px-8"
      accent={["#3ad6ff", "#8b5cf6"]}
      blur={36}
      frost={0.45}
      staticHighlight
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-cyan-300/40 to-violet-400/40 font-mono text-sm font-semibold text-white shadow-glass">
            {MOCK_PROVIDER.avatarInitials}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-white">
              {MOCK_PROVIDER.fullName}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-white/55">
              {MOCK_PROVIDER.specialty} · {MOCK_CLINIC.city}, {MOCK_CLINIC.countryCode}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-right sm:gap-10">
          <Stat label="Queue depth" value="14" />
          <Stat label="Avg wait" value="8m 24s" />
          <Stat label="ETA conf." value="0.86" mono />
        </div>
      </div>
    </LiquidGlassSurface>
  );
}

function ArchitectureFootnote() {
  return (
    <section className="grid grid-cols-1 gap-4 text-sm text-white/65 sm:grid-cols-3">
      <FootnoteCell
        title="Multi-Tenant Postgres"
        body="Shared schema, clinicId-scoped indexes, Timestamptz(6) lifecycle stamps."
      />
      <FootnoteCell
        title="Autonomous Retention"
        body="node-cron + Redis lock. Tickets older than 7 days are gzipped, AES-256-GCM encrypted, and purged from the hot path."
      />
      <FootnoteCell
        title="Liquid Glass Realtime"
        body="Redis Pub/Sub → Socket.IO → Framer Motion springs. Every mutation lands on screen within one frame."
      />
    </section>
  );
}

function SectionLabel({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
        {kicker}
      </span>
      <span className="text-lg font-semibold text-white">{title}</span>
      <span className="font-mono text-[11px] text-white/55">{subtitle}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </span>
      <span className={mono ? "font-mono text-base text-white" : "text-base font-semibold text-white"}>
        {value}
      </span>
    </div>
  );
}

function FootnoteCell({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{body}</p>
    </div>
  );
}
