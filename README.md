# NavbatCore
NavbatCore is a distributed, real-time clinic queue infrastructure. It replaces physical waiting rooms using an Exponential Moving Average (EMA) algorithm for dynamic ETAs, PostgreSQL optimistic locking to prevent double-booking race conditions, and Redis-backed WebSockets for millisecond state sync. Built for high-concurrency healthcare.
