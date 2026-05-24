/**
 * Redis clients + Pub/Sub channel helpers.
 *
 * We keep three logical clients because ioredis subscribers can't issue
 * regular commands while subscribed:
 *
 *   redis        — generic command client (GET/SET/INCR/EVAL).
 *   redisPub     — publish-only client (avoids head-of-line blocking with cmd).
 *   redisSub     — subscribe-only client (used by realtime server).
 *
 * All channel names go through `channels.*` so the keyspace is auditable.
 */

import Redis, { type RedisOptions } from "ioredis";

import { env } from "@/env";
import { childLogger } from "@/lib/logger";

const log = childLogger("redis");

const baseOptions: RedisOptions = {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
    return targetErrors.some((m) => err.message.includes(m));
  },
};

const buildClient = (label: string) => {
  const client = new Redis(env.REDIS_URL, baseOptions);
  client.on("error", (err) => log.error({ label, err: err.message }, "redis_error"));
  client.on("end", () => log.warn({ label }, "redis_end"));
  client.on("reconnecting", (delay: number) =>
    log.warn({ label, delay }, "redis_reconnecting"),
  );
  return client;
};

export const redis = buildClient("cmd");
export const redisPub = buildClient("pub");
export const redisSub = buildClient("sub");

const ns = env.REDIS_NAMESPACE;

/**
 * Channel registry.
 *
 * Convention: `${namespace}:${domain}:${tenant}:${detail}`
 * Tenants are addressed by clinic id so a wildcard subscriber per clinic
 * can cheaply mux all ticket events with `psubscribe`.
 */
export const channels = {
  ticket: {
    /** Per-clinic ticket mutation feed. */
    forClinic: (clinicId: string) => `${ns}:ticket:${clinicId}:mutation`,
    /** Single-ticket targeted updates (e.g. countdown ETA refresh). */
    forTicket: (clinicId: string, ticketId: string) =>
      `${ns}:ticket:${clinicId}:${ticketId}`,
    /** Tenant-wide pattern subscription. */
    pattern: (clinicId: string) => `${ns}:ticket:${clinicId}:*`,
  },
  retention: {
    /** Worker leader-election lock. */
    lockKey: () => `${ns}:retention:lock`,
    /** Run-progress feed for ops dashboards. */
    progress: () => `${ns}:retention:progress`,
  },
} as const;

/**
 * Publish a JSON-encoded event with publish-time timestamping. Returns the
 * number of receivers that got the message (per ioredis).
 */
export const publishJson = async <T extends object>(
  channel: string,
  payload: T,
): Promise<number> => {
  const enriched = { ...payload, _ts: Date.now(), _channel: channel };
  return redisPub.publish(channel, JSON.stringify(enriched));
};

/**
 * SETNX-style distributed lock with a millisecond TTL. Returns the acquired
 * token on success (used to release safely) or null on contention.
 */
export const acquireLock = async (
  key: string,
  ttlMs: number,
): Promise<string | null> => {
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(key, token, "PX", ttlMs, "NX");
  return ok === "OK" ? token : null;
};

const RELEASE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export const releaseLock = async (key: string, token: string): Promise<boolean> => {
  const result = (await redis.eval(RELEASE_LUA, 1, key, token)) as number;
  return result === 1;
};

export const disposeRedis = async (): Promise<void> => {
  await Promise.allSettled([redis.quit(), redisPub.quit(), redisSub.quit()]);
};
