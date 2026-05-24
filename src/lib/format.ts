/**
 * Locale-deterministic time / date formatters.
 *
 * Hydration-safety contract:
 *   * `formatHHmm` and `formatDateUz` use `Intl.DateTimeFormat` with an
 *     explicit `timeZone` ("Asia/Tashkent") and explicit BCP-47 locale, so
 *     they produce byte-identical output on Node SSR and on the browser.
 *   * `formatElapsed` is purely arithmetic (no `Date`, no locale) — it
 *     cannot drift between server and client.
 *
 * Anything that needs to render a clock value should compute it server-side
 * via these helpers and ship the resulting string to a client component.
 */

const TASHKENT_TZ = "Asia/Tashkent";

const HHMM_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TASHKENT_TZ,
});

/** "HH:mm" in 24-hour clock, anchored to Asia/Tashkent. */
export const formatHHmm = (d: Date): string => HHMM_FMT.format(d);

/**
 * Uzbek localized date in the form `24-may, 2026`.
 *
 * We do the locale layout ourselves rather than relying on `uz-UZ` because
 * different ICU versions diverge on Uzbek month names and on the comma /
 * dash separator. Fixing the layout in code keeps SSR/CSR identical
 * regardless of the runtime's ICU build.
 */
const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const DMY_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: TASHKENT_TZ,
});

export const formatDateUz = (d: Date): string => {
  const parts = DMY_FMT.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const monthRaw = parts.find((p) => p.type === "month")?.value ?? "1";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const monthIdx = Math.max(0, Math.min(11, parseInt(monthRaw, 10) - 1));
  return `${day}-${UZ_MONTHS[monthIdx]}, ${year}`;
};

// -----------------------------------------------------------------------------
// Elapsed-time formatter
// -----------------------------------------------------------------------------

const pad2 = (n: number): string => n.toString().padStart(2, "0");

/**
 * Formats a non-negative number of seconds as `mm:ss`, or `hh:mm:ss` when
 * the value crosses one hour. Used by the live "Sarflangan vaqt" cell —
 * the server seeds the initial value, the client increments it.
 */
export const formatElapsed = (totalSec: number): string => {
  const sign = totalSec < 0 ? "-" : "";
  const s = Math.abs(Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${sign}${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  return `${sign}${pad2(m)}:${pad2(sec)}`;
};
