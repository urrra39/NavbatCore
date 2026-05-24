/**
 * Mock dataset — until the booking + dashboard plug into real Postgres.
 *
 * Every page that needs sample data imports from here so the public search
 * portal, the clinic detail page, and the receptionist dashboard agree on
 * the same clinics, departments, and tickets. Replace with Prisma queries
 * during integration; signatures are kept narrow on purpose.
 */

import { formatHHmm } from "@/lib/format";
import {
  type DashboardTicket,
  Department,
  Severity,
  TicketStatus,
  computeExpectedAt,
} from "@/lib/triage";

// -----------------------------------------------------------------------------
// Clinics
// -----------------------------------------------------------------------------

export interface MockDoctor {
  id: string;
  fullName: string;
  specialty: string;
  initials: string;
  department: Department;
  room: string;
  /** Average minutes per consultation (used for the queue depth ETA). */
  avgConsultMin: number;
  /** SLA threshold per consultation (seconds). */
  slaThresholdSec: number;
}

export interface MockClinic {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  city: string;
  district?: string;
  addressLine: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  /** SEO description, in Uzbek. */
  description: string;
  /** Working-hours summary string for the card (e.g. "08:00 — 20:00"). */
  hoursSummary: string;
  departments: Department[];
  doctors: MockDoctor[];
  /** Live queue depth aggregated across departments. */
  liveQueueDepth: number;
}

export const MOCK_CLINICS: ReadonlyArray<MockClinic> = [
  {
    id: "clx_clinic_tashkent_main",
    slug: "akfa-medline-tashkent",
    displayName: "Akfa Medline · Toshkent (Markaziy)",
    legalName: "Akfa Medline MChJ",
    city: "Toshkent",
    district: "Yunusobod",
    addressLine: "Amir Temur shoh ko'chasi 22A",
    phone: "+998 78 140 77 77",
    rating: 4.8,
    reviewsCount: 1284,
    description:
      "Akfa Medline shifoxonalar tarmog'ining markaziy filiali. Yuqori malakali shifokorlar, zamonaviy diagnostika qurilmalari va onlayn navbat tizimi orqali qulay xizmat ko'rsatamiz.",
    hoursSummary: "Kunlik 08:00 — 20:00 (24/7 shoshilinch yordam)",
    departments: [
      Department.KARDIOLOGIYA,
      Department.STOMATOLOGIYA,
      Department.LOR,
      Department.NEVROLOGIYA,
    ],
    doctors: [
      {
        id: "doc_kard_1",
        fullName: "Dr. Bobur Yo'ldoshev",
        specialty: "Kardiolog · Yuqori toifa",
        initials: "BY",
        department: Department.KARDIOLOGIYA,
        room: "Xona 207",
        avgConsultMin: 22,
        slaThresholdSec: 25 * 60,
      },
      {
        id: "doc_kard_2",
        fullName: "Dr. Nigora Saidova",
        specialty: "Kardiolog",
        initials: "NS",
        department: Department.KARDIOLOGIYA,
        room: "Xona 209",
        avgConsultMin: 18,
        slaThresholdSec: 20 * 60,
      },
      {
        id: "doc_stom_1",
        fullName: "Dr. Asror Musayev",
        specialty: "Stomatolog-terapevt",
        initials: "AM",
        department: Department.STOMATOLOGIYA,
        room: "Xona 112",
        avgConsultMin: 25,
        slaThresholdSec: 30 * 60,
      },
      {
        id: "doc_stom_2",
        fullName: "Dr. Lola Abdurahmonova",
        specialty: "Stomatolog-jarroh",
        initials: "LA",
        department: Department.STOMATOLOGIYA,
        room: "Xona 114",
        avgConsultMin: 30,
        slaThresholdSec: 35 * 60,
      },
      {
        id: "doc_lor_1",
        fullName: "Dr. Sanjar Rashidov",
        specialty: "LOR shifokori",
        initials: "SR",
        department: Department.LOR,
        room: "Xona 305",
        avgConsultMin: 15,
        slaThresholdSec: 18 * 60,
      },
      {
        id: "doc_lor_2",
        fullName: "Dr. Madina Yo'ldosheva",
        specialty: "LOR-pediatr",
        initials: "MY",
        department: Department.LOR,
        room: "Xona 307",
        avgConsultMin: 18,
        slaThresholdSec: 20 * 60,
      },
      {
        id: "doc_nev_1",
        fullName: "Dr. Ravshan Qurbonov",
        specialty: "Nevrolog · Birinchi toifa",
        initials: "RQ",
        department: Department.NEVROLOGIYA,
        room: "Xona 401",
        avgConsultMin: 30,
        slaThresholdSec: 35 * 60,
      },
      {
        id: "doc_nev_2",
        fullName: "Dr. Kamola Inoyatova",
        specialty: "Nevrolog",
        initials: "KI",
        department: Department.NEVROLOGIYA,
        room: "Xona 403",
        avgConsultMin: 25,
        slaThresholdSec: 30 * 60,
      },
    ],
    liveQueueDepth: 19,
  },
  {
    id: "clx_clinic_samarqand",
    slug: "akfa-medline-samarqand",
    displayName: "Akfa Medline · Samarqand",
    legalName: "Akfa Medline MChJ",
    city: "Samarqand",
    district: "Markaz",
    addressLine: "Mustaqillik ko'chasi 14",
    phone: "+998 66 233 11 22",
    rating: 4.7,
    reviewsCount: 642,
    description:
      "Akfa Medline Samarqand filiali yuqori malakali shifokorlar va zamonaviy uskunalar bilan jihozlangan. Onlayn navbat oling, vaqtingizni tejang.",
    hoursSummary: "Kunlik 08:00 — 19:00",
    departments: [
      Department.KARDIOLOGIYA,
      Department.STOMATOLOGIYA,
      Department.LOR,
    ],
    doctors: [],
    liveQueueDepth: 7,
  },
  {
    id: "clx_clinic_buxoro",
    slug: "akfa-medline-buxoro",
    displayName: "Akfa Medline · Buxoro",
    legalName: "Akfa Medline MChJ",
    city: "Buxoro",
    district: "Markaz",
    addressLine: "Bahouddin Naqshband ko'chasi 7",
    phone: "+998 65 224 88 88",
    rating: 4.6,
    reviewsCount: 318,
    description:
      "Buxorodagi zamonaviy klinika — kardiologiya, stomatologiya, LOR va nevrologiya bo'limlari. Onlayn navbat orqali jonli kutish vaqtini ko'rib oling.",
    hoursSummary: "Kunlik 08:00 — 19:00",
    departments: [
      Department.KARDIOLOGIYA,
      Department.STOMATOLOGIYA,
      Department.NEVROLOGIYA,
    ],
    doctors: [],
    liveQueueDepth: 5,
  },
  {
    id: "clx_clinic_namangan",
    slug: "akfa-medline-namangan",
    displayName: "Akfa Medline · Namangan",
    legalName: "Akfa Medline MChJ",
    city: "Namangan",
    addressLine: "Islom Karimov shoh ko'chasi 18",
    phone: "+998 69 233 55 55",
    rating: 4.5,
    reviewsCount: 211,
    description:
      "Namangan shahridagi yangi filial. Bemorlar uchun keng to'lash usullari, qulay parking va onlayn navbat xizmatlari.",
    hoursSummary: "Kunlik 08:00 — 18:00",
    departments: [Department.KARDIOLOGIYA, Department.LOR],
    doctors: [],
    liveQueueDepth: 3,
  },
  {
    id: "clx_clinic_andijon",
    slug: "akfa-medline-andijon",
    displayName: "Akfa Medline · Andijon",
    legalName: "Akfa Medline MChJ",
    city: "Andijon",
    addressLine: "Bobur shoh ko'chasi 9",
    phone: "+998 74 233 44 44",
    rating: 4.4,
    reviewsCount: 142,
    description:
      "Andijondagi filial — sertifikatlangan shifokorlar va shaffof narxlar siyosati.",
    hoursSummary: "Kunlik 08:00 — 18:00",
    departments: [Department.STOMATOLOGIYA, Department.LOR],
    doctors: [],
    liveQueueDepth: 2,
  },
  {
    id: "clx_clinic_nukus",
    slug: "akfa-medline-nukus",
    displayName: "Akfa Medline · Nukus",
    legalName: "Akfa Medline MChJ",
    city: "Nukus",
    addressLine: "A. Dosnazarov ko'chasi 22",
    phone: "+998 61 222 33 33",
    rating: 4.6,
    reviewsCount: 89,
    description:
      "Qoraqalpog'iston Respublikasidagi yagona Akfa Medline filiali. Kardiologiya va nevrologiya bo'limlari faol.",
    hoursSummary: "Kunlik 08:00 — 18:00",
    departments: [Department.KARDIOLOGIYA, Department.NEVROLOGIYA],
    doctors: [],
    liveQueueDepth: 4,
  },
];

export const findClinicBySlug = (slug: string): MockClinic | undefined =>
  MOCK_CLINICS.find((c) => c.slug === slug);

// -----------------------------------------------------------------------------
// Tickets — current Tashkent main clinic queue
// -----------------------------------------------------------------------------

export interface TicketSeed {
  patientFullName: string;
  patientInitials: string;
  ticketCode: string;
  department: Department;
  severity: Severity;
  status: TicketStatus;
  enteredMinAgo: number;
  doctorFullName: string;
  room: string;
  emergency?: boolean;
}

export const TICKET_SEEDS: ReadonlyArray<TicketSeed> = [
  // ---- Kardiologiya
  { patientFullName: "Akmal Karimov", patientInitials: "AK", ticketCode: "K-104", department: Department.KARDIOLOGIYA, severity: Severity.OGIR, status: TicketStatus.QABULDA, enteredMinAgo: 38, doctorFullName: "Dr. Bobur Yo'ldoshev", room: "Xona 207" },
  { patientFullName: "Dilnoza Rahmonova", patientInitials: "DR", ticketCode: "K-105", department: Department.KARDIOLOGIYA, severity: Severity.ORTA, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 22, doctorFullName: "Dr. Bobur Yo'ldoshev", room: "Xona 207" },
  { patientFullName: "Sherzod Tursunov", patientInitials: "ST", ticketCode: "K-106", department: Department.KARDIOLOGIYA, severity: Severity.YENGIL, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 12, doctorFullName: "Dr. Nigora Saidova", room: "Xona 209" },
  { patientFullName: "Malika Yusupova", patientInitials: "MY", ticketCode: "K-107", department: Department.KARDIOLOGIYA, severity: Severity.ORTA, status: TicketStatus.KUTMOQDA, enteredMinAgo: 7, doctorFullName: "Dr. Nigora Saidova", room: "Xona 209" },
  { patientFullName: "Bekzod Aliyev", patientInitials: "BA", ticketCode: "K-108", department: Department.KARDIOLOGIYA, severity: Severity.YENGIL, status: TicketStatus.TUGATILDI, enteredMinAgo: 95, doctorFullName: "Dr. Bobur Yo'ldoshev", room: "Xona 207" },

  // ---- Stomatologiya
  { patientFullName: "Nodira Pirmatova", patientInitials: "NP", ticketCode: "S-052", department: Department.STOMATOLOGIYA, severity: Severity.ORTA, status: TicketStatus.QABULDA, enteredMinAgo: 28, doctorFullName: "Dr. Asror Musayev", room: "Xona 112" },
  { patientFullName: "Jasur Norboyev", patientInitials: "JN", ticketCode: "S-053", department: Department.STOMATOLOGIYA, severity: Severity.YENGIL, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 18, doctorFullName: "Dr. Asror Musayev", room: "Xona 112" },
  { patientFullName: "Gulnora Hamidova", patientInitials: "GH", ticketCode: "S-054", department: Department.STOMATOLOGIYA, severity: Severity.OGIR, status: TicketStatus.KUTMOQDA, enteredMinAgo: 15, doctorFullName: "Dr. Lola Abdurahmonova", room: "Xona 114" },
  { patientFullName: "Rustam Mirzayev", patientInitials: "RM", ticketCode: "S-055", department: Department.STOMATOLOGIYA, severity: Severity.YENGIL, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 9, doctorFullName: "Dr. Lola Abdurahmonova", room: "Xona 114" },
  { patientFullName: "Sevara Ibragimova", patientInitials: "SI", ticketCode: "S-056", department: Department.STOMATOLOGIYA, severity: Severity.YENGIL, status: TicketStatus.BEKOR_QILINGAN, enteredMinAgo: 67, doctorFullName: "Dr. Asror Musayev", room: "Xona 112" },

  // ---- LOR
  { patientFullName: "Ulug'bek Hasanov", patientInitials: "UH", ticketCode: "L-031", department: Department.LOR, severity: Severity.YENGIL, status: TicketStatus.QABULDA, enteredMinAgo: 14, doctorFullName: "Dr. Sanjar Rashidov", room: "Xona 305" },
  { patientFullName: "Zarina Mirzajonova", patientInitials: "ZM", ticketCode: "L-032", department: Department.LOR, severity: Severity.ORTA, status: TicketStatus.KUTMOQDA, enteredMinAgo: 10, doctorFullName: "Dr. Sanjar Rashidov", room: "Xona 305" },
  { patientFullName: "Aziz Otaboyev", patientInitials: "AO", ticketCode: "L-033", department: Department.LOR, severity: Severity.YENGIL, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 5, doctorFullName: "Dr. Madina Yo'ldosheva", room: "Xona 307" },
  { patientFullName: "Feruza Nazarova", patientInitials: "FN", ticketCode: "L-034", department: Department.LOR, severity: Severity.OGIR, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 32, doctorFullName: "Dr. Madina Yo'ldosheva", room: "Xona 307" },

  // ---- Nevrologiya
  { patientFullName: "Otabek Sodiqov", patientInitials: "OS", ticketCode: "N-088", department: Department.NEVROLOGIYA, severity: Severity.OGIR, status: TicketStatus.QABULDA, enteredMinAgo: 41, doctorFullName: "Dr. Ravshan Qurbonov", room: "Xona 401" },
  { patientFullName: "Mavluda Eshimova", patientInitials: "ME", ticketCode: "N-089", department: Department.NEVROLOGIYA, severity: Severity.OGIR, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 26, doctorFullName: "Dr. Ravshan Qurbonov", room: "Xona 401" },
  { patientFullName: "Sardor Komilov", patientInitials: "SK", ticketCode: "N-090", department: Department.NEVROLOGIYA, severity: Severity.ORTA, status: TicketStatus.TASDIQLANGAN, enteredMinAgo: 13, doctorFullName: "Dr. Kamola Inoyatova", room: "Xona 403" },
  { patientFullName: "Iroda Tojiboyeva", patientInitials: "IT", ticketCode: "N-091", department: Department.NEVROLOGIYA, severity: Severity.ORTA, status: TicketStatus.KUTMOQDA, enteredMinAgo: 6, doctorFullName: "Dr. Kamola Inoyatova", room: "Xona 403" },
  { patientFullName: "Anvar Yusufjonov", patientInitials: "AY", ticketCode: "N-092", department: Department.NEVROLOGIYA, severity: Severity.YENGIL, status: TicketStatus.KELMADI, enteredMinAgo: 78, doctorFullName: "Dr. Ravshan Qurbonov", room: "Xona 401" },
];

/**
 * Build the wire-friendly ticket list anchored to a server-supplied `now`.
 * Every clock-derived value is pre-formatted so client hydration is byte-
 * identical to server SSR output.
 */
export const buildDashboardTickets = (now: Date): DashboardTicket[] =>
  TICKET_SEEDS.map((seed, idx) => {
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
      emergency: seed.emergency ?? false,
    };
  });

// -----------------------------------------------------------------------------
// SLA incidents (for the clinic-admin view)
// -----------------------------------------------------------------------------

export interface MockSlaIncident {
  id: string;
  ticketCode: string;
  doctorName: string;
  department: Department;
  budgetMin: number;
  observedMin: number;
  detectedMinAgo: number;
}

export const MOCK_SLA_INCIDENTS: ReadonlyArray<MockSlaIncident> = [
  { id: "sla_1", ticketCode: "K-098", doctorName: "Dr. Bobur Yo'ldoshev", department: Department.KARDIOLOGIYA, budgetMin: 25, observedMin: 38, detectedMinAgo: 9 },
  { id: "sla_2", ticketCode: "N-085", doctorName: "Dr. Ravshan Qurbonov", department: Department.NEVROLOGIYA, budgetMin: 35, observedMin: 47, detectedMinAgo: 24 },
  { id: "sla_3", ticketCode: "S-049", doctorName: "Dr. Asror Musayev", department: Department.STOMATOLOGIYA, budgetMin: 30, observedMin: 36, detectedMinAgo: 41 },
];

// -----------------------------------------------------------------------------
// Cross-tenant analytics (for the super-admin view)
// -----------------------------------------------------------------------------

export interface MockClinicSummary {
  clinicId: string;
  clinicName: string;
  city: string;
  activeQueues: number;
  todaysPatients: number;
  slaBreaches24h: number;
  isActive: boolean;
}

export const MOCK_CLINIC_SUMMARIES: ReadonlyArray<MockClinicSummary> = [
  { clinicId: "clx_clinic_tashkent_main", clinicName: "Akfa Medline · Toshkent", city: "Toshkent", activeQueues: 19, todaysPatients: 187, slaBreaches24h: 4, isActive: true },
  { clinicId: "clx_clinic_samarqand", clinicName: "Akfa Medline · Samarqand", city: "Samarqand", activeQueues: 7, todaysPatients: 92, slaBreaches24h: 1, isActive: true },
  { clinicId: "clx_clinic_buxoro", clinicName: "Akfa Medline · Buxoro", city: "Buxoro", activeQueues: 5, todaysPatients: 64, slaBreaches24h: 0, isActive: true },
  { clinicId: "clx_clinic_namangan", clinicName: "Akfa Medline · Namangan", city: "Namangan", activeQueues: 3, todaysPatients: 41, slaBreaches24h: 0, isActive: true },
  { clinicId: "clx_clinic_andijon", clinicName: "Akfa Medline · Andijon", city: "Andijon", activeQueues: 2, todaysPatients: 28, slaBreaches24h: 1, isActive: true },
  { clinicId: "clx_clinic_nukus", clinicName: "Akfa Medline · Nukus", city: "Nukus", activeQueues: 4, todaysPatients: 35, slaBreaches24h: 0, isActive: false },
];
