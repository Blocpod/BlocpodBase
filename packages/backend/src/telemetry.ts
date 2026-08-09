import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEvent {
  level: LogLevel;
  event: string;
  requestId?: string;
  chainId?: number;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

const sensitiveKey = /(authorization|cookie|private.?key|secret|signature|token|raw.?body|prompt)/i;

export function requestId(headers?: Headers): string {
  const incoming = headers?.get("x-request-id");
  return incoming && /^[A-Za-z0-9_-]{8,80}$/.test(incoming) ? incoming : randomUUID();
}

export function safeLog(event: LogEvent, write: (line: string) => void = console.log): void {
  write(JSON.stringify(redact(event)));
}

function redact(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([itemKey, item]) => [itemKey, redact(item, itemKey)]));
  }
  return value;
}
