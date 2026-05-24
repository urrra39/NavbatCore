/**
 * Prisma client singleton.
 *
 * Hot-reload friendly: caches the client on `globalThis` so Next.js dev
 * server doesn't open a new pool on every HMR cycle. Long-running workers
 * (retention.worker.ts) call `disposePrisma()` on graceful shutdown to
 * flush in-flight queries before exit.
 */

import { PrismaClient, Prisma } from "@prisma/client";

import { env, isProd } from "@/env";
import { childLogger } from "@/lib/logger";

const log = childLogger("prisma");

declare global {
  // eslint-disable-next-line no-var
  var __navbatPrisma: PrismaClient | undefined;
}

const buildClient = (): PrismaClient =>
  new PrismaClient({
    log: isProd
      ? [{ level: "error", emit: "event" }, { level: "warn", emit: "event" }]
      : [
          { level: "error", emit: "event" },
          { level: "warn", emit: "event" },
          { level: "info", emit: "event" },
        ],
    datasources: { db: { url: env.DATABASE_URL } },
    errorFormat: isProd ? "minimal" : "pretty",
  });

export const prisma: PrismaClient = globalThis.__navbatPrisma ?? buildClient();

if (!isProd) {
  globalThis.__navbatPrisma = prisma;
}

// Pipe Prisma's structured log events into our pino logger.
// `as any` because Prisma's overloaded $on signatures don't intersect cleanly
// with the union literal we pass at construction time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on("error", (e: Prisma.LogEvent) => log.error({ event: e }, "prisma_error"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on("warn", (e: Prisma.LogEvent) => log.warn({ event: e }, "prisma_warn"));

export const disposePrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};

export type { Prisma } from "@prisma/client";
