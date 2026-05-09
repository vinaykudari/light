import { getEnvValue } from "@/lib/env";

export type NiaIndexSource = {
  title: string;
  url: string;
  kind: "trial" | "paper" | "x" | "web";
  snippet?: string;
};

export type NiaIndexedSource = NiaIndexSource & {
  sourceId?: string;
  status: "indexed" | "failed";
  message?: string;
};

export async function indexNiaSources(sources: NiaIndexSource[]): Promise<NiaIndexedSource[]> {
  const token = getEnvValue(["NIA_API_KEY", "NIA_TOKEN"]);
  if (!token) return sources.map((source) => ({ ...source, status: "failed", message: "Nia API key missing" }));
  const distinct = dedupeSources(sources).slice(0, 24);
  const results: NiaIndexedSource[] = [];
  for (const source of distinct) {
    results.push(await indexOneSource(token, source));
  }
  return results;
}

export async function queryNiaCorpus(input: {
  question: string;
  indexedSources: NiaIndexedSource[];
  context: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ content: string; retrievalLogId?: string; sourceMode: "real" | "mixed" }> {
  const token = getEnvValue(["NIA_API_KEY", "NIA_TOKEN"]);
  if (!token) return { content: "Nia is not configured for this deployment.", sourceMode: "mixed" };
  const indexed = input.indexedSources.filter((source) => source.status === "indexed");
  const messages = [
    ...(input.history ?? []).slice(-6),
    { role: "user" as const, content: `${input.question}\n\nLight run context:\n${input.context}` },
  ];
  const body = {
    mode: "query",
    messages,
    data_sources: indexed.map((source) => source.sourceId ?? source.url),
    include_sources: true,
    fast_mode: true,
    max_tokens: 2200,
  };
  const response = await fetchNia("/search", token, body, 25000);
  if (!response.ok) {
    return { content: "Nia query failed for the indexed corpus.", sourceMode: "mixed" };
  }
  const json = await response.json() as Record<string, unknown>;
  return {
    content: text(json.content) ?? "Nia returned no answer for the indexed corpus.",
    retrievalLogId: text(json.retrieval_log_id),
    sourceMode: "real",
  };
}

async function indexOneSource(token: string, source: NiaIndexSource): Promise<NiaIndexedSource> {
  const body = { type: "documentation", url: source.url };
  const response = await fetchNia("/sources", token, body, 12000);
  if (response.ok) {
    const json = await response.json() as Record<string, unknown>;
    return { ...source, sourceId: text(json.id), status: "indexed", message: text(json.status) ?? "queued" };
  }
  const fallback = await fetchNia("/shell-docs/index", token, { url: source.url, force_refresh: false }, 12000);
  if (!fallback.ok) {
    return { ...source, status: "failed", message: `Nia indexing failed with HTTP ${fallback.status}` };
  }
  const json = await fallback.json().catch(() => ({})) as Record<string, unknown>;
  return { ...source, sourceId: text(json.id), status: "indexed", message: "queued" };
}

async function fetchNia(path: string, token: string, body: unknown, timeoutMs: number): Promise<Response> {
  const base = getEnvValue(["NIA_BASE_URL"]) ?? "https://apigcp.trynia.ai/v2";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeSources(sources: NiaIndexSource[]): NiaIndexSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return /^https?:\/\//i.test(key);
  });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
