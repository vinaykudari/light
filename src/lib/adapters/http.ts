export class AdapterHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
  ) {
    super(`HTTP ${status} ${statusText}`.trim());
    this.name = "AdapterHttpError";
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const body = parseJson(text);

    if (!response.ok) {
      throw new AdapterHttpError(response.status, response.statusText, body);
    }

    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUrl(base: string, params: Record<string, unknown>): string {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(","));
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function stringArray(value: unknown): string[] {
  return asArray(value).flatMap((item) => {
    const text = asString(item);
    return text ? [text] : [];
  });
}

export function compact<T>(values: Array<T | undefined | null | false>): T[] {
  return values.filter(Boolean) as T[];
}

export function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  const candidate = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(Math.max(candidate, min), max);
}

export function reasonFromError(error: unknown): string {
  if (error instanceof AdapterHttpError) {
    return `upstream returned ${error.status}`;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "upstream request timed out";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "upstream request failed";
}

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
