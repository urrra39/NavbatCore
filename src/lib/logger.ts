/**
 * Centralized pino logger.
 *
 * Production: JSON one-line-per-event (ingestible by Loki/Datadog).
 * Development: pretty-printed with colorized levels.
 *
 * All long-lived processes (worker, realtime server, Next.js custom server)
 * MUST use child loggers with a `component` field so log streams can be split.
 */

import pino, { type LoggerOptions } from "pino";

import { env, isProd } from "@/env";

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: "navbatcore",
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.encryptionKey",
      "ARCHIVE_ENCRYPTION_KEY",
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger = isProd
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: false,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname,service,env",
        },
      },
    });

export const childLogger = (component: string, extra?: Record<string, unknown>) =>
  logger.child({ component, ...(extra ?? {}) });
