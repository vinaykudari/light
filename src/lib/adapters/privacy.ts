const HANDLE_RE = /(^|[\s([{"'])@[\w_]{1,30}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactUsernames(value: string): string {
  return value
    .replace(EMAIL_RE, "[email]")
    .replace(HANDLE_RE, (match, prefix: string) => `${prefix}[handle]`);
}

export function cleanText(value: unknown, maxLength = 800): string {
  const text = typeof value === "string" ? value : "";
  return redactUsernames(text.replace(/\s+/g, " ").trim()).slice(0, maxLength);
}

export function cleanOptionalText(value: unknown, maxLength = 800): string | undefined {
  const text = cleanText(value, maxLength);
  return text.length > 0 ? text : undefined;
}

export function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}
