import { seedResearch } from "@/lib/demo/seedResearch";
import type { PatientProfile, ResearchPaper, ResearchSummary, SourceMode, TrialCard } from "@/lib/types";

export async function searchPubMed(
  patient: PatientProfile,
  trials: TrialCard[],
): Promise<ResearchSummary> {
  const query = buildQuery(patient, trials);
  try {
    const ids = await fetchPubMedIds(query);
    const fallbackQuery = buildFallbackQuery(patient);
    const retryIds = ids.length ? ids : await fetchPubMedIds(fallbackQuery);
    const usedQuery = ids.length ? query : fallbackQuery;
    const papers = retryIds.length ? await fetchPubMedSummaries(retryIds) : [];
    const selected = papers.slice(0, 5);
    if (selected.length === 0) return buildSummary(query, seedResearch, "mock");
    return buildSummary(usedQuery, selected, "real");
  } catch {
    return buildSummary(query, seedResearch, "mock");
  }
}

function buildQuery(patient: PatientProfile, trials: TrialCard[]): string {
  const interventions = trials
    .flatMap((trial) => trial.title.match(/[A-Z]{2,}[0-9A-Z-]*/g) ?? [])
    .slice(0, 2);
  return [`"${patient.biomarkers[0] ?? patient.diagnosis}"`, "NSCLC", ...interventions].join(" ");
}

function buildFallbackQuery(patient: PatientProfile): string {
  return [`"${patient.biomarkers[0] ?? patient.diagnosis}"`, "NSCLC", "clinical trial"].join(" ");
}

async function fetchPubMedIds(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: "8",
    sort: "relevance",
  });
  const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`);
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
  const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params.toString()}`);
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

function buildSummary(query: string, papers: ResearchPaper[], sourceMode: SourceMode): ResearchSummary {
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
