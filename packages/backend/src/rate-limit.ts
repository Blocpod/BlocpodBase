import { createHash } from "node:crypto";
import type { Sql } from "postgres";

export interface RateLimiter {
  consume(scope: string, subject: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  async consume(scope: string, subject: string, limit: number, windowMs: number) {
    const now = Date.now();
    const key = `${scope}:${digest(subject)}`;
    const current = this.windows.get(key);
    const value = !current || now - current.start >= windowMs ? { start: now, count: 1 } : { ...current, count: current.count + 1 };
    this.windows.set(key, value);
    return { allowed: value.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((value.start + windowMs - now) / 1000)) };
  }
}

export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly sql: Sql) {}

  async consume(scope: string, subject: string, limit: number, windowMs: number) {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const rows = await this.sql<Array<{ request_count: number }>>`
      INSERT INTO api_rate_limits (scope, subject_hash, window_start, request_count)
      VALUES (${scope}, ${digest(subject)}, ${windowStart.toISOString()}, 1)
      ON CONFLICT (scope, subject_hash, window_start)
      DO UPDATE SET request_count = api_rate_limits.request_count + 1
      RETURNING request_count
    `;
    return {
      allowed: (rows[0]?.request_count ?? limit + 1) <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000)),
    };
  }
}

const digest = (value: string) => createHash("sha256").update(value.toLowerCase()).digest("hex");
