import { searchSeededInsights } from "@/lib/demo";
import type { AdapterResult, ResearchInsight, SearchInput } from "./types";
import { resolveEnv } from "./env";
import {
  asArray,
  asNumber,
  asRecord,
  clamp,
  fetchJson,
  reasonFromError,
} from "./http";
import { cleanOptionalText, cleanText, cleanUrl } from "./privacy";

const SOURCE = "Nia";
const DEFAULT_BASE_URL = "https://apigcp.trynia.ai/v2";

export interface NiaSearchInput extends SearchInput {
  mode?: "query" | "web" | "deep" | "universal";
}

export async function searchNia(input: NiaSearchInput): Promise<AdapterResult<ResearchInsight>> {
  const maxResults = clamp(input.maxResults, 5, 1, 10);
  const token = await resolveEnv("NIA_API_KEY", ["NIA_TOKEN"]);

  if (!token) {
    return fallbackNia(input, "Nia token is not configured", maxResults);
  }

  try {
    const baseUrl = (await resolveEnv("NIA_BASE_URL")) ?? DEFAULT_BASE_URL;
    const path = await resolveNiaPath(input.mode ?? "web");
    const data = await fetchJson<unknown>(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildNiaBody(input, maxResults)),
    });
    const items = mapNiaResults(data, maxResults);

    return {
      source: SOURCE,
      mode: "active",
      fetchedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return fallbackNia(input, reasonFromError(error), maxResults);
  }
}

async function resolveNiaPath(mode: NiaSearchInput["mode"]): Promise<string> {
  const override = await resolveEnv("NIA_SEARCH_PATH");
  if (override) {
    return override.startsWith("/") ? override : `/${override}`;
  }

  return {
    query: "/search/query",
    web: "/search/web",
    deep: "/search/deep",
    universal: "/search/universal",
  }[mode ?? "web"];
}

function buildNiaBody(input: NiaSearchInput, maxResults: number): Record<string, unknown> {
  return {
    query: input.query,
    limit: maxResults,
    max_results: maxResults,
    mode: input.mode === "query" ? "unified" : input.mode,
  };
}

function mapNiaResults(data: unknown, maxResults: number): ResearchInsight[] {
  const record = asRecord(data);
  const answer = cleanOptionalText(record.answer ?? record.result ?? record.summary, 800);
  const rows = [
    ...asArray(record.results),
    ...asArray(record.items),
    ...asArray(record.documents),
    ...asArray(record.sources),
  ];
  const mapped = rows
    .map(mapNiaItem)
    .filter((item): item is ResearchInsight => Boolean(item));

  if (mapped.length > 0) {
    return mapped.slice(0, maxResults);
  }

  return answer
    ? [{ id: "nia-answer", title: "Nia answer", snippet: answer, source: SOURCE }]
    : [];
}

function mapNiaItem(value: unknown, index: number): ResearchInsight | undefined {
  const item = asRecord(value);
  const url = cleanUrl(item.url ?? item.link);
  const title =
    cleanOptionalText(item.title ?? item.name, 180) ??
    cleanOptionalText(url, 180) ??
    "Nia result";
  const snippet = cleanText(
    item.snippet ?? item.content ?? item.text ?? item.summary ?? item.description,
    500,
  );

  if (!snippet && !url) {
    return undefined;
  }

  return {
    id: `nia-${index + 1}`,
    title,
    snippet,
    url,
    source: cleanOptionalText(item.source, 120) ?? SOURCE,
    score: asNumber(item.score),
  };
}

function fallbackNia(
  input: SearchInput,
  reason: string,
  maxResults: number,
): AdapterResult<ResearchInsight> {
  return {
    source: SOURCE,
    mode: "fallback",
    reason,
    fetchedAt: new Date().toISOString(),
    items: searchSeededInsights(input.query, maxResults),
  };
}
