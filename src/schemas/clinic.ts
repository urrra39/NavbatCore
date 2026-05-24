/**
 * Zod schemas for Clinic.settings and Clinic.theme JSONB blobs.
 *
 * These run on every admin write so a misconfigured slot duration or
 * negative grace window can never reach the queue worker.
 */

import { z } from "zod";

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hh_mm_required");

const OpeningHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0 = Sunday
  open: HHMM,
  close: HHMM,
  /** True if the clinic is closed that day; open/close are ignored. */
  closed: z.boolean().default(false),
});

export const ClinicSettingsSchema = z.object({
  /** Default slot length when a service does not override it. */
  slotDurationSec: z.number().int().min(60).max(8 * 3600).default(900),
  /** Largest allowed live queue depth — guardrails the EMA estimator. */
  maxQueueDepth: z.number().int().min(1).max(5000).default(250),
  /** Minutes a patient has after etaAt before being marked NO_SHOW. */
  graceWindowSec: z.number().int().min(0).max(3600).default(600),
  /** EMA smoothing factor. 0 = static prior, 1 = pure last sample. */
  emaAlpha: z.number().min(0).max(1).default(0.35),
  /** Allow scheduling beyond capacity (controlled overbooking). */
  allowOverbook: z.boolean().default(false),
  /** Auto-mark CHECKED_IN if patient is within N meters at scheduledFor. */
  autoCheckInRadiusMeters: z.number().int().min(0).max(2000).default(0),
  openingHours: z.array(OpeningHoursSchema).max(7).default([]),
  /** Whether the clinic should be indexed by the public SEO portal. */
  publicListing: z.boolean().default(true),
});

export type ClinicSettings = z.infer<typeof ClinicSettingsSchema>;

export const ClinicThemeSchema = z.object({
  /** Hex or rgba CSS color. Used as Liquid Glass primary accent. */
  accent: z.string().max(32).default("#3ad6ff"),
  accent2: z.string().max(32).default("#8b5cf6"),
  /** Backdrop blur radius in px. */
  blur: z.number().int().min(0).max(120).default(48),
  /** 0..1 — how heavily the frosted overlay tints under light backgrounds. */
  frost: z.number().min(0).max(1).default(0.55),
  logoUrl: z.string().url().optional(),
});

export type ClinicTheme = z.infer<typeof ClinicThemeSchema>;
