import { synthesizeResearchWithLlm } from "@/lib/llm/researchSynthesis";
import type { PatientProfile, ResearchPaper, ResearchSummary, SourceMode, TrialCard } from "@/lib/types";

export async function searchPubMed(
  patient: PatientProfile,
  trials: TrialCard[],
): Promise<ResearchSummary> {
  const queries = buildQueries(patient, trials);
  const query = queries[0];
  try {
    const { ids: retryIds, query: usedQuery } = await firstMatchingPubMedQuery(queries);
    const papers = retryIds.length ? await fetchPubMedSummaries(retryIds) : [];
    const selected = papers.slice(0, 5);
    return buildSummary(usedQuery, selected, "real", patient);
  } catch {
    return buildSummary(query, [], "mixed", patient);
  }
}

function buildQueries(patient: PatientProfile, trials: TrialCard[]): string[] {
  if (hasSymptoms(patient)) {
    const condition = compactCondition(patient.possibleConditionContext ?? patient.diagnosis);
    const symptoms = (patient.symptoms ?? []).slice(0, 5);
    return unique([
      [condition, ...symptoms.slice(0, 2)].join(" "),
      condition,
      [patient.possibleConditionContext ?? patient.diagnosis, ...symptoms.slice(0, 3)].join(" "),
      symptoms.slice(0, 4).join(" "),
    ]);
  }
  const interventions = trials
    .flatMap((trial) => trial.title.match(/[A-Z]{2,}[0-9A-Z-]*/g) ?? [])
    .slice(0, 2);
  return unique([
    [`"${patient.biomarkers[0] ?? patient.diagnosis}"`, "NSCLC", ...interventions].join(" "),
    [`"${patient.biomarkers[0] ?? patient.diagnosis}"`, "clinical trial"].join(" "),
  ]);
}

async function firstMatchingPubMedQuery(queries: string[]): Promise<{ ids: string[]; query: string }> {
  for (const query of queries) {
    const ids = await fetchPubMedIds(query);
    if (ids.length) return { ids, query };
  }
  return { ids: [], query: queries[0] ?? "" };
}

async function fetchPubMedIds(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: "8",
    sort: "relevance",
  });
  const response = await fetchWithTimeout(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`);
  if (!response.ok) throw new Error("PubMed search failed");
  const json = (await response.json()) as { esearchresult?: { idlist?: string[] } };
  return json.esearchresult?.idlist ?? [];
}

async function fetchPubMedSummaries(ids: string[]): Promise<ResearchPaper[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
  });
  const response = await fetchWithTimeout(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params.toString()}`);
  if (!response.ok) throw new Error("PubMed summary failed");
  const json = (await response.json()) as { result?: Record<string, PubMedDoc | string[]> };
  return ids.flatMap((id) => {
    const doc = json.result?.[id] as PubMedDoc | undefined;
    if (!doc?.title) return [];
    return [{
      title: doc.title,
      authors: doc.authors
        ?.map((author) => author.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 4),
      year: Number.parseInt(String(doc.pubdate ?? "").slice(0, 4), 10) || undefined,
      source: "PubMed" as const,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      relevanceReason: "Retrieved from PubMed for clinician review of trial and biomarker context.",
    }];
  });
}

function buildSummary(query: string, papers: ResearchPaper[], sourceMode: SourceMode, patient?: PatientProfile): Promise<ResearchSummary> | ResearchSummary {
  if (patient && hasSymptoms(patient)) {
    return synthesizeResearchWithLlm(patient, query, papers, sourceMode);
  }
  return {
    query,
    papersFound: papers.length,
    selectedPapers: papers,
    themes: [
      "EGFR exon 20 insertion trials require careful biomarker confirmation.",
      "Post-platinum treatment context and resistance history should be reviewed by the clinician.",
      "Trial screening may depend on tissue, imaging, labs, and prior therapy timing.",
    ],
    clinicianQuestions: [
      "Does the protocol require central confirmation of EGFR exon 20 insertion?",
      "Which prior therapies and dates should be documented before referral?",
      "What evidence gaps should be discussed with the study team?",
    ],
    limitations: [
      "Paper retrieval is educational context only and is not a treatment recommendation.",
      "Abstract-level public records may omit protocol-specific eligibility details.",
    ],
    sourceMode,
  };
}

type PubMedDoc = {
  title?: string;
  pubdate?: string;
  authors?: Array<{ name?: string }>;
};

function hasSymptoms(patient: PatientProfile): boolean {
  return Boolean(patient.symptoms?.length || patient.possibleConditionContext || patient.patientGoal);
}

function compactCondition(condition: string): string {
  return condition.split(/\bwith\b|[,;(/]/i)[0]?.trim() || condition;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 5);
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
