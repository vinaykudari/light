import { searchSeededInsights } from "@/lib/demo";
import type { AdapterResult, ResearchInsight, SearchInput } from "./types";
import { resolveEnv } from "./env";
import {
  AdapterHttpError,
  asArray,
  asNumber,
  asRecord,
  clamp,
  fetchJson,
  reasonFromError,
} from "./http";
import { cleanOptionalText, cleanText } from "./privacy";

const SOURCE = "Hyperspell";
const DEFAULT_BASE_URL = "https://api.hyperspell.com";

export interface HyperspellQueryInput extends SearchInput {
  answer?: boolean;
  sources?: string[];
}

export async function queryHyperspell(
  input: HyperspellQueryInput,
): Promise<AdapterResult<ResearchInsight>> {
  const maxResults = clamp(input.maxResults, 5, 1, 20);
  const token = await resolveEnv("HYPERSPELL_TOKEN", ["HYPERSPELL_API_KEY"]);

  if (!token) {
    return fallbackHyperspell(input, "Hyperspell token is not configured", maxResults);
  }

  try {
    const data = await postHyperspell(input, token, maxResults, "/query");
    return activeHyperspell(mapHyperspell(data, maxResults));
  } catch (error) {
    if (error instanceof AdapterHttpError && error.status === 404) {
      try {
        const data = await postHyperspell(input, token, maxResults, "/memories/query");
        return activeHyperspell(mapHyperspell(data, maxResults));
      } catch (legacyError) {
        return fallbackHyperspell(input, reasonFromError(legacyError), maxResults);
      }
    }
    return fallbackHyperspell(input, reasonFromError(error), maxResults);
  }
}

async function postHyperspell(
  input: HyperspellQueryInput,
  token: string,
  maxResults: number,
  path: string,
): Promise<unknown> {
  const baseUrl = (await resolveEnv("HYPERSPELL_BASE_URL")) ?? DEFAULT_BASE_URL;
  const userId = await resolveEnv("HYPERSPELL_USER_ID", ["HYPERSPELL_AS_USER"]);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (userId) {
    headers["X-As-User"] = userId;
  }

  return fetchJson<unknown>(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: input.query,
      answer: input.answer ?? true,
      sources: input.sources,
      max_results: maxResults,
      options: { max_results: maxResults },
    }),
  });
}

function mapHyperspell(data: unknown, maxResults: number): ResearchInsight[] {
  const record = asRecord(data);
  const answer = cleanOptionalText(record.answer, 800);
  const documents = asArray(record.documents)
    .map(mapDocument)
    .filter((item): item is ResearchInsight => Boolean(item));

  if (documents.length > 0) {
    return documents.slice(0, maxResults);
  }

  return answer
    ? [{ id: "hyperspell-answer", title: "Hyperspell answer", snippet: answer, source: SOURCE }]
    : [];
}

function mapDocument(value: unknown, index: number): ResearchInsight | undefined {
  const doc = asRecord(value);
  const title = cleanOptionalText(doc.title, 180) ?? "Memory result";
  const snippet = cleanText(doc.text ?? doc.content ?? doc.summary ?? doc.data, 500);

  if (!snippet) {
    return undefined;
  }

  return {
    id: `hyperspell-${index + 1}`,
    title,
    snippet,
    source: cleanOptionalText(doc.source, 120) ?? SOURCE,
    score: asNumber(doc.score),
  };
}

function activeHyperspell(items: ResearchInsight[]): AdapterResult<ResearchInsight> {
  return {
    source: SOURCE,
    mode: "active",
    fetchedAt: new Date().toISOString(),
    items,
  };
}

function fallbackHyperspell(
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
