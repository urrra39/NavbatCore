/**
 * Zod schemas for the public booking flow.
 *
 *   * `ClinicSearchInputSchema` — query parameters for `/c/search`.
 *   * `BookingFormInputSchema`  — patient-submitted form on `/c/[slug]`.
 *   * `TrackingHashSchema`      — opaque hash on `/t/[code]`.
 *
 * The booking schema rejects:
 *   - empty / suspicious names (regex enforces letters + spaces + apostrophes)
 *   - phone numbers outside +998 E.164 (Uzbekistan dial code) — adjust per-tenant
 *   - severity values not in the YENGIL/ORTA/OGIR triage matrix.
 */

import { z } from "zod";

import { SeveritySchema } from "@/schemas/ticket";

const UZ_NAME_RE = /^[A-Za-z'\u02BB\u2019\s-]{2,80}$/;
const UZ_PHONE_RE = /^\+998\d{9}$/;

export const ClinicSearchInputSchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Department code filter. */
  dep: z
    .enum(["KARDIOLOGIYA", "STOMATOLOGIYA", "LOR", "NEVROLOGIYA"])
    .optional(),
  city: z.string().trim().max(80).optional(),
});

export type ClinicSearchInput = z.infer<typeof ClinicSearchInputSchema>;

export const BookingFormInputSchema = z.object({
  clinicSlug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "invalid_slug"),
  departmentCode: z.enum([
    "KARDIOLOGIYA",
    "STOMATOLOGIYA",
    "LOR",
    "NEVROLOGIYA",
  ]),
  fullName: z
    .string()
    .trim()
    .min(2, "ism_kamida_2_belgi")
    .max(80, "ism_uzunligi_chegaradan_oshdi")
    .regex(UZ_NAME_RE, "ism_formati_notogri"),
  phoneE164: z
    .string()
    .trim()
    .regex(UZ_PHONE_RE, "telefon_+998_formatda_kiriting"),
  severity: SeveritySchema,
  symptomNote: z.string().max(500).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "shaxsiy_malumotlar_roziligi_talab_qilinadi" }),
  }),
});

export type BookingFormInput = z.infer<typeof BookingFormInputSchema>;

export const TrackingHashSchema = z
  .string()
  .regex(/^c[a-z0-9]{20,}$/i, "invalid_tracking_hash");

export type TrackingHash = z.infer<typeof TrackingHashSchema>;
