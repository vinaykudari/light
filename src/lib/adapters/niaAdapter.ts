import { getEnvValue } from "@/lib/env";
import { synthesizeVoiceFromSearchContext } from "@/lib/llm/patientVoiceSynthesis";
import type { PatientProfile, PatientVoiceSource, PatientVoiceTheme, ResearchPaper, SourceMode, TrialCard } from "@/lib/types";

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

export async function searchNiaPatientVoice(
  patient: PatientProfile,
): Promise<{ themes: PatientVoiceTheme[]; sourceMode: SourceMode; message?: string }> {
  const token = getEnvValue(["NIA_API_KEY", "NIA_TOKEN"]);
  if (!token) return { themes: [], sourceMode: "mixed", message: "Nia unavailable for patient voice context" };
  try {
    const condition = compactCondition(patient.possibleConditionContext ?? patient.diagnosis);
    const symptoms = (patient.symptoms ?? []).slice(0, 5).join(" ");
    const query = [
      condition,
      symptoms,
      "patient experience public posts clinical trial symptoms burden reimbursement visits objective measures",
    ].join(" ");
    const json = await fetchNia(token, query);
    const context = JSON.stringify(json).slice(0, 7000);
    const synthesis = await synthesizeVoiceFromSearchContext(patient, context, "Nia search/context retrieval");
    return {
      themes: synthesis.themes,
      sourceMode: synthesis.sourceMode,
      message: `Nia retrieved patient-experience search context for ${synthesis.themes.length} aggregate themes`,
    };
  } catch {
    return { themes: [], sourceMode: "mixed", message: "Nia patient voice context request failed" };
  }
}

export async function searchNiaExpertSources(
  patient: PatientProfile,
): Promise<{ sources: PatientVoiceSource[]; sourceMode: SourceMode; message?: string }> {
  const token = getEnvValue(["NIA_API_KEY", "NIA_TOKEN"]);
  if (!token) return { sources: [], sourceMode: "mixed", message: "Nia unavailable for expert context" };
  try {
    const condition = compactCondition(patient.possibleConditionContext ?? patient.diagnosis);
    const symptoms = (patient.symptoms ?? []).slice(0, 5).join(" ");
    const query = [
      condition,
      symptoms,
      "clinician researcher expert commentary clinical trial outcome measures consensus guideline patient reported outcomes",
    ].join(" ");
    const json = await fetchNia(token, query);
    return {
      sources: mapNiaSources(json).slice(0, 6),
      sourceMode: "real",
      message: "Nia retrieved expert-facing web context",
    };
  } catch {
    return { sources: [], sourceMode: "mixed", message: "Nia expert context request failed" };
  }
}

function compactCondition(condition: string): string {
  return condition.split(/\bwith\b|[,;(/]/i)[0]?.trim() || condition;
}

async function fetchNia(token: string, query: string): Promise<Record<string, unknown>> {
  const base = getEnvValue(["NIA_BASE_URL"]) ?? "https://apigcp.trynia.ai/v2";
  const response = await fetchWithTimeout(`${base.replace(/\/$/, "")}/search`, {
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
  }, 8000);
  if (!response.ok) throw new Error("Nia search failed");
  return response.json() as Promise<Record<string, unknown>>;
}

function buildQuery(patient: PatientProfile, trials: TrialCard[]): string {
  const interventions = trials
    .flatMap((trial) => trial.title.match(/[A-Z][A-Za-z0-9-]{4,}/g) ?? [])
    .slice(0, 4);
  return [
    patient.possibleConditionContext ?? patient.diagnosis,
    [...(patient.symptoms ?? []), ...patient.biomarkers].join(" "),
    "clinical trial research paper protocol patient experience eligibility outcomes biomarkers",
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

function mapNiaSources(json: Record<string, unknown>): PatientVoiceSource[] {
  return [
    ...rows(json.other_content),
    ...rows(json.documentation),
    ...rows(json.results),
    ...rows(json.sources),
  ]
    .flatMap((item): PatientVoiceSource[] => {
      const source = isRecord(item.source) ? item.source : {};
      const url = text(item.url) ?? text(item.link) ?? text(source.url);
      const title = usableTitle(text(item.title)) ?? text(source.display_name) ?? text(source.document_name) ?? titleFromUrl(url);
      const snippet = text(item.summary) ?? text(item.snippet) ?? text(item.content);
      if (!url && !snippet) return [];
      return [{
        title: title ?? "Expert web context",
        url,
        source: /(?:x|twitter)\.com/i.test(url ?? "") ? "x" as const : "web" as const,
        snippet,
      }];
    });
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
