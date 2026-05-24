/**
 * Strongly-typed, fail-fast environment loader.
 *
 * Every server entrypoint (Next.js server, retention worker, realtime server)
 * imports `env` from this module instead of touching `process.env` directly.
 * If a variable is missing or malformed the process exits with a precise
 * Zod error before any DB / Redis client is constructed.
 */

import { z } from "zod";

const booleanish = z
  .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
  .transform((v) => v === "1" || v === "true");

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  SHADOW_DATABASE_URL: z.string().url().optional(),

  REDIS_URL: z.string().url(),
  REDIS_NAMESPACE: z.string().min(1).default("navbat"),

  SOCKET_PORT: z.coerce.number().int().positive().default(4001),
  SOCKET_ORIGIN: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SOCKET_URL: z
    .string()
    .url()
    .default("http://localhost:4001"),

  /**
   * Base64-encoded 32-byte master key used to derive AES-256-GCM keys for
   * the cold archive. Generate with:
   *   openssl rand -base64 32
   */
  ARCHIVE_ENCRYPTION_KEY: z
    .string()
    .min(1, "ARCHIVE_ENCRYPTION_KEY is required")
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ARCHIVE_ENCRYPTION_KEY must decode to exactly 32 bytes",
    }),
  ARCHIVE_KEY_ID: z.string().min(1).default("ark-default"),

  RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(7),
  /** Standard 5-field cron expression. node-cron validates this. */
  RETENTION_CRON: z.string().min(1).default("0 3 * * *"),
  RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(10_000).default(500),
  RETENTION_RUN_ONCE: booleanish.default("0"),

  AUDIT_HMAC_SECRET: z
    .string()
    .min(32, "AUDIT_HMAC_SECRET must be at least 32 chars")
    .default(
      "dev-only-audit-hmac-secret-replace-me-in-production-please-32",
    ),
  HIS_GATEWAY_HMAC_SECRET: z
    .string()
    .min(16)
    .default("dev-only-his-shared-secret-16chr"),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "[env] Invalid environment configuration:\n",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env: Env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
