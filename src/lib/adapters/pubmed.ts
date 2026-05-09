import { searchSeededPublications } from "@/lib/demo";
import type { AdapterResult, PublicationRecord, SearchInput } from "./types";
import { resolveEnv } from "./env";
import {
  asArray,
  asRecord,
  asString,
  buildUrl,
  clamp,
  fetchJson,
  reasonFromError,
} from "./http";
import { cleanOptionalText, cleanText } from "./privacy";

const SOURCE = "PubMed/NCBI";
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export async function searchPubMed(input: SearchInput): Promise<AdapterResult<PublicationRecord>> {
  const maxResults = clamp(input.maxResults, 8, 1, 25);

  try {
    const ids = await searchIds(input.query, maxResults);
    if (ids.length === 0) {
      return activeResult([]);
    }

    const records = await fetchSummaries(ids);
    return activeResult(records.slice(0, maxResults));
  } catch (error) {
    return {
      source: SOURCE,
      mode: "fallback",
      reason: reasonFromError(error),
      fetchedAt: new Date().toISOString(),
      items: searchSeededPublications(input.query, maxResults),
    };
  }
}

async function searchIds(query: string, maxResults: number): Promise<string[]> {
  const apiKey = await resolveEnv("NCBI_API_KEY");
  const email = await resolveEnv("NCBI_EMAIL");
  const tool = (await resolveEnv("NCBI_TOOL")) ?? "light-hackathon";
  const data = await fetchJson<unknown>(
    buildUrl(`${EUTILS}/esearch.fcgi`, {
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: maxResults,
      sort: "relevance",
      api_key: apiKey,
      email,
      tool,
    }),
  );

  return asArray(asRecord(asRecord(data).esearchresult).idlist).flatMap((id) => {
    const text = asString(id);
    return text ? [text] : [];
  });
}

async function fetchSummaries(ids: string[]): Promise<PublicationRecord[]> {
  const apiKey = await resolveEnv("NCBI_API_KEY");
  const data = await fetchJson<unknown>(
    buildUrl(`${EUTILS}/esummary.fcgi`, {
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
      api_key: apiKey,
    }),
  );
  const result = asRecord(asRecord(data).result);
  const uids = asArray(result.uids).flatMap((id) => {
    const text = asString(id);
    return text ? [text] : [];
  });

  return uids.flatMap((uid) => {
    const summary = asRecord(result[uid]);
    const title = cleanText(summary.title, 260);
    if (!title) {
      return [];
    }
    return [mapSummary(uid, summary, title)];
  });
}

function mapSummary(
  uid: string,
  summary: Record<string, unknown>,
  title: string,
): PublicationRecord {
  const articleIds = asArray(summary.articleids).map(asRecord);
  const doi = articleIds
    .find((item) => asString(item.idtype)?.toLowerCase() === "doi")
    ?.value;

  return {
    id: uid,
    pmid: uid,
    title,
    journal: cleanOptionalText(summary.fulljournalname ?? summary.source, 180),
    publishedAt: cleanOptionalText(summary.pubdate, 80),
    authors: asArray(summary.authors)
      .map((author) => cleanOptionalText(asRecord(author).name, 120))
      .filter((name): name is string => Boolean(name))
      .slice(0, 8),
    doi: cleanOptionalText(doi, 120),
    url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(uid)}/`,
    summary: cleanOptionalText(summary.sorttitle, 300),
  };
}

function activeResult(items: PublicationRecord[]): AdapterResult<PublicationRecord> {
  return {
    source: SOURCE,
    mode: "active",
    fetchedAt: new Date().toISOString(),
    items,
  };
}
