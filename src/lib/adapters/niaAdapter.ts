import { getEnvValue } from "@/lib/env";
import type { PatientProfile, ResearchPaper, TrialCard } from "@/lib/types";

export async function searchNiaContext(
  patient: PatientProfile,
  trials: TrialCard[],
): Promise<{ papers: ResearchPaper[]; available: boolean; message?: string }> {
  const token = getEnvValue(["NIA_API_KEY", "NIA_TOKEN"]);
  if (!token) {
    return {
      papers: [],
      available: false,
      message: "Nia unavailable, adapter preserved for paper and protocol retrieval",
    };
  }
  try {
    const query = buildQuery(patient, trials);
    const json = await fetchNia(token, query);
    const papers = mapNiaPapers(json).slice(0, 5);
    return {
      papers,
      available: true,
      message: papers.length
        ? `Nia retrieved ${papers.length} cross-source research and protocol contexts`
        : "Nia returned no usable context for this profile",
    };
  } catch {
    return {
      papers: [],
      available: true,
      message: "Nia API request failed, continuing with PubMed and fallback context",
    };
  }
}

async function fetchNia(token: string, query: string): Promise<Record<string, unknown>> {
  const base = getEnvValue(["NIA_BASE_URL"]) ?? "https://apigcp.trynia.ai/v2";
  const response = await fetch(`${base.replace(/\/$/, "")}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "web",
      query,
      include_sources: true,
      fast_mode: true,
      max_tokens: 900,
    }),
  });
  if (!response.ok) throw new Error("Nia search failed");
  return response.json() as Promise<Record<string, unknown>>;
}

function buildQuery(patient: PatientProfile, trials: TrialCard[]): string {
  const interventions = trials
    .flatMap((trial) => trial.title.match(/[A-Z][A-Za-z0-9-]{4,}/g) ?? [])
    .slice(0, 4);
  return [
    patient.diagnosis,
    patient.biomarkers.join(" "),
    "clinical trial research paper protocol biopsy reimbursement eligibility",
    ...interventions,
  ].join(" ");
}

function mapNiaPapers(json: Record<string, unknown>): ResearchPaper[] {
  return [
    ...rows(json.other_content),
    ...rows(json.documentation),
    ...rows(json.results),
    ...rows(json.sources),
  ]
    .map(mapNiaItem)
    .filter((paper): paper is ResearchPaper => Boolean(paper));
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function mapNiaItem(item: Record<string, unknown>, index: number): ResearchPaper | undefined {
  const source = isRecord(item.source) ? item.source : {};
  const url = text(item.url) ?? text(source.url);
  const rawTitle = text(item.title);
  const title = usableTitle(rawTitle) ?? text(source.display_name) ?? text(source.document_name) ?? titleFromUrl(url);
  const summary = text(item.summary) ?? text(item.snippet) ?? text(item.content);
  if (!title && !summary) return undefined;
  return {
    title: title ?? `Nia context ${index + 1}`,
    source: "Nia",
    url,
    abstract: summary,
    relevanceReason: "Retrieved through Nia for cross-source trial, protocol, research, or reimbursement context.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown): string | undefined {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean ? clean.slice(0, 800) : undefined;
}

function usableTitle(value: string | undefined): string | undefined {
  if (!value || /^content$/i.test(value)) return undefined;
  return value;
}

function titleFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
