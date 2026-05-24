/**
 * Akfa Medline · Bosh navbat boshqaruv paneli (Dashboard).
 *
 * Server Component. Responsibilities:
 *   1. Capture a single request-time anchor (`now`).
 *   2. Build the mock ticket dataset from a stable seed table and pre-format
 *      every clock-derived field into a string with the `Asia/Tashkent` Intl
 *      formatter — this guarantees SSR and CSR produce identical text.
 *   3. Hand the (already-serializable) dataset down to <DashboardShell/>,
 *      which is the only client component on the page and which owns the
 *      department-tab state.
 *
 * Hydration policy:
 *   * No client-side `Date.now()` or `new Date()` runs during the initial
 *     render. The only ticking value (Sarflangan vaqt) is seeded from a
 *     server-computed `initialElapsedSec` and starts ticking strictly
 *     inside `useEffect` — see ElapsedTime.tsx.
 *   * `dynamic = "force-dynamic"` keeps the cache disabled so every visit
 *     gets a fresh anchor and the elapsed counters look "live" on first
 *     load instead of frozen at build time.
 */

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { formatDateUz, formatHHmm } from "@/lib/format";
import {
  type DashboardTicket,
  Department,
  QueueStatus,
  Severity,
  computeExpectedAt,
} from "@/lib/triage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// -----------------------------------------------------------------------------
// Seed dataset
// -----------------------------------------------------------------------------

interface Seed {
  patientFullName: string;
  patientInitials: string;
  ticketCode: string;
  department: Department;
  severity: Severity;
  status: QueueStatus;
  /** How many minutes ago the patient was registered. Drives entryAt. */
  enteredMinAgo: number;
  doctorFullName: string;
  room: string;
}

const SEEDS: ReadonlyArray<Seed> = [
  // ---- Kardiologiya -------------------------------------------------------
  {
    patientFullName: "Akmal Karimov",
    patientInitials: "AK",
    ticketCode: "K-104",
    department: Department.KARDIOLOGIYA,
    severity: Severity.OGIR,
    status: QueueStatus.QABULDA,
    enteredMinAgo: 38,
    doctorFullName: "Dr. Bobur Yo'ldoshev",
    room: "Xona 207",
  },
  {
    patientFullName: "Dilnoza Rahmonova",
    patientInitials: "DR",
    ticketCode: "K-105",
    department: Department.KARDIOLOGIYA,
    severity: Severity.ORTA,
    status: QueueStatus.ROYXATDA,
    enteredMinAgo: 22,
    doctorFullName: "Dr. Bobur Yo'ldoshev",
    room: "Xona 207",
  },
  {
    patientFullName: "Sherzod Tursunov",
    patientInitials: "ST",
    ticketCode: "K-106",
    department: Department.KARDIOLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.TASDIQLANGAN,
    enteredMinAgo: 12,
    doctorFullName: "Dr. Nigora Saidova",
    room: "Xona 209",
  },
  {
    patientFullName: "Malika Yusupova",
    patientInitials: "MY",
    ticketCode: "K-107",
    department: Department.KARDIOLOGIYA,
    severity: Severity.ORTA,
    status: QueueStatus.KUTMOQDA,
    enteredMinAgo: 7,
    doctorFullName: "Dr. Nigora Saidova",
    room: "Xona 209",
  },
  {
    patientFullName: "Bekzod Aliyev",
    patientInitials: "BA",
    ticketCode: "K-108",
    department: Department.KARDIOLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.TUGATILDI,
    enteredMinAgo: 95,
    doctorFullName: "Dr. Bobur Yo'ldoshev",
    room: "Xona 207",
  },

  // ---- Stomatologiya ------------------------------------------------------
  {
    patientFullName: "Nodira Pirmatova",
    patientInitials: "NP",
    ticketCode: "S-052",
    department: Department.STOMATOLOGIYA,
    severity: Severity.ORTA,
    status: QueueStatus.QABULDA,
    enteredMinAgo: 28,
    doctorFullName: "Dr. Asror Musayev",
    room: "Xona 112",
  },
  {
    patientFullName: "Jasur Norboyev",
    patientInitials: "JN",
    ticketCode: "S-053",
    department: Department.STOMATOLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.ROYXATDA,
    enteredMinAgo: 18,
    doctorFullName: "Dr. Asror Musayev",
    room: "Xona 112",
  },
  {
    patientFullName: "Gulnora Hamidova",
    patientInitials: "GH",
    ticketCode: "S-054",
    department: Department.STOMATOLOGIYA,
    severity: Severity.OGIR,
    status: QueueStatus.KUTMOQDA,
    enteredMinAgo: 15,
    doctorFullName: "Dr. Lola Abdurahmonova",
    room: "Xona 114",
  },
  {
    patientFullName: "Rustam Mirzayev",
    patientInitials: "RM",
    ticketCode: "S-055",
    department: Department.STOMATOLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.TASDIQLANGAN,
    enteredMinAgo: 9,
    doctorFullName: "Dr. Lola Abdurahmonova",
    room: "Xona 114",
  },
  {
    patientFullName: "Sevara Ibragimova",
    patientInitials: "SI",
    ticketCode: "S-056",
    department: Department.STOMATOLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.BEKOR,
    enteredMinAgo: 67,
    doctorFullName: "Dr. Asror Musayev",
    room: "Xona 112",
  },

  // ---- LOR ----------------------------------------------------------------
  {
    patientFullName: "Ulug'bek Hasanov",
    patientInitials: "UH",
    ticketCode: "L-031",
    department: Department.LOR,
    severity: Severity.YENGIL,
    status: QueueStatus.QABULDA,
    enteredMinAgo: 14,
    doctorFullName: "Dr. Sanjar Rashidov",
    room: "Xona 305",
  },
  {
    patientFullName: "Zarina Mirzajonova",
    patientInitials: "ZM",
    ticketCode: "L-032",
    department: Department.LOR,
    severity: Severity.ORTA,
    status: QueueStatus.KUTMOQDA,
    enteredMinAgo: 10,
    doctorFullName: "Dr. Sanjar Rashidov",
    room: "Xona 305",
  },
  {
    patientFullName: "Aziz Otaboyev",
    patientInitials: "AO",
    ticketCode: "L-033",
    department: Department.LOR,
    severity: Severity.YENGIL,
    status: QueueStatus.TASDIQLANGAN,
    enteredMinAgo: 5,
    doctorFullName: "Dr. Madina Yo'ldosheva",
    room: "Xona 307",
  },
  {
    patientFullName: "Feruza Nazarova",
    patientInitials: "FN",
    ticketCode: "L-034",
    department: Department.LOR,
    severity: Severity.OGIR,
    status: QueueStatus.ROYXATDA,
    enteredMinAgo: 32,
    doctorFullName: "Dr. Madina Yo'ldosheva",
    room: "Xona 307",
  },

  // ---- Nevrologiya --------------------------------------------------------
  {
    patientFullName: "Otabek Sodiqov",
    patientInitials: "OS",
    ticketCode: "N-088",
    department: Department.NEVROLOGIYA,
    severity: Severity.OGIR,
    status: QueueStatus.QABULDA,
    enteredMinAgo: 41,
    doctorFullName: "Dr. Ravshan Qurbonov",
    room: "Xona 401",
  },
  {
    patientFullName: "Mavluda Eshimova",
    patientInitials: "ME",
    ticketCode: "N-089",
    department: Department.NEVROLOGIYA,
    severity: Severity.OGIR,
    status: QueueStatus.ROYXATDA,
    enteredMinAgo: 26,
    doctorFullName: "Dr. Ravshan Qurbonov",
    room: "Xona 401",
  },
  {
    patientFullName: "Sardor Komilov",
    patientInitials: "SK",
    ticketCode: "N-090",
    department: Department.NEVROLOGIYA,
    severity: Severity.ORTA,
    status: QueueStatus.TASDIQLANGAN,
    enteredMinAgo: 13,
    doctorFullName: "Dr. Kamola Inoyatova",
    room: "Xona 403",
  },
  {
    patientFullName: "Iroda Tojiboyeva",
    patientInitials: "IT",
    ticketCode: "N-091",
    department: Department.NEVROLOGIYA,
    severity: Severity.ORTA,
    status: QueueStatus.KUTMOQDA,
    enteredMinAgo: 6,
    doctorFullName: "Dr. Kamola Inoyatova",
    room: "Xona 403",
  },
  {
    patientFullName: "Anvar Yusufjonov",
    patientInitials: "AY",
    ticketCode: "N-092",
    department: Department.NEVROLOGIYA,
    severity: Severity.YENGIL,
    status: QueueStatus.KELMADI,
    enteredMinAgo: 78,
    doctorFullName: "Dr. Ravshan Qurbonov",
    room: "Xona 401",
  },
];

const buildTickets = (now: Date): DashboardTicket[] =>
  SEEDS.map((seed, idx) => {
    const entryAt = new Date(now.getTime() - seed.enteredMinAgo * 60_000);
    const expectedAt = computeExpectedAt(entryAt, seed.severity);
    const initialElapsedSec = Math.max(
      0,
      Math.floor((now.getTime() - entryAt.getTime()) / 1000),
    );
    return {
      id: `t_${idx.toString().padStart(3, "0")}`,
      ticketCode: seed.ticketCode,
      patientFullName: seed.patientFullName,
      patientInitials: seed.patientInitials,
      doctorFullName: seed.doctorFullName,
      room: seed.room,
      department: seed.department,
      severity: seed.severity,
      status: seed.status,
      entryAt: entryAt.toISOString(),
      entryAtFormatted: formatHHmm(entryAt),
      expectedAt: expectedAt.toISOString(),
      expectedAtFormatted: formatHHmm(expectedAt),
      initialElapsedSec,
    };
  });

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function DashboardPage() {
  const now = new Date();
  const tickets = buildTickets(now);
  const generatedAtFormatted = `${formatDateUz(now)} · ${formatHHmm(now)}`;

  return (
    <main className="min-h-dvh bg-slate-50">
      {/* ---------- Top bar ---------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:py-6">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
            >
              <span className="text-lg font-bold leading-none">A</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                Akfa Medline
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Bosh navbat boshqaruv paneli
              </h1>
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-emerald-500"
              />
              <span className="font-medium">Tizim faol</span>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:inline-flex">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Sana
              </span>
              <span className="font-mono text-xs text-slate-800">
                {generatedAtFormatted}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700"
              >
                NM
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-900">
                  Nilufar Madaminova
                </span>
                <span className="text-[11px] text-slate-500">
                  Bosh navbatchi
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Content ---------- */}
      <div className="mx-auto max-w-7xl px-6 py-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Bo'limlar bo'yicha jonli navbat
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            Bemorlar saralash algoritmiga ko'ra taqsimlanadi: yengil holat 15
            daqiqa, o'rta holat 25 daqiqa, og'ir holat 45 daqiqa. Quyidagi
            bo'limlardan birini tanlang.
          </p>
        </div>

        <DashboardShell
          tickets={tickets}
          generatedAtFormatted={generatedAtFormatted}
        />
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div>
            Akfa Medline shifoxonalar tarmog'i · NavbatCore navbat boshqaruv
            tizimi
          </div>
          <div className="font-mono">
            Saralash algoritmi v1.2 · Toshkent vaqti
          </div>
        </div>
      </footer>
    </main>
  );
}
