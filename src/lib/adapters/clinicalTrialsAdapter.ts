import { seedTrials } from "@/lib/demo/seedTrials";
import type { PatientProfile, TrialCard, TrialLocation } from "@/lib/types";

type SearchResult = {
  trials: TrialCard[];
  sourceMode: "real" | "mock";
  message?: string;
  querySummary?: string;
};

type CtStudy = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string };
    designModule?: { phases?: string[]; studyType?: string };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: { interventions?: Array<{ name?: string }> };
    eligibilityModule?: { eligibilityCriteria?: string };
    contactsLocationsModule?: { locations?: TrialLocation[] };
  };
};

export async function searchClinicalTrials(patient: PatientProfile): Promise<SearchResult> {
  try {
    const plans = queryPlans(patient);
    const studies = dedupeStudies((await Promise.all(plans.map(fetchStudies))).flat());
    const normalized = studies
      .map((study) => normalizeStudy(study, patient))
      .filter((trial): trial is TrialCard => Boolean(trial));
    const active = normalized.filter(isActiveTrial);
    const ranked = rankTrials(active.length ? active : normalized, patient);
    if (!ranked.length) {
      return {
        trials: seedTrials,
        sourceMode: "mock",
        message: "No matching official trial records found, using seeded demo data",
      };
    }
    return {
      trials: ranked,
      sourceMode: "real",
      querySummary: `${studies.length} official ClinicalTrials.gov records scanned from ${plans.length} live queries`,
    };
  } catch (error) {
    return {
      trials: seedTrials,
      sourceMode: "mock",
      message: `ClinicalTrials.gov unavailable, using seeded demo data: ${safeError(error)}`,
    };
  }
}

function queryPlans(patient: PatientProfile): URLSearchParams[] {
  const biomarker = patient.biomarkers[0] ?? "EGFR exon 20";
  return [
    plan({ "query.cond": "non-small cell lung cancer", "query.term": biomarker }),
    plan({ "query.term": `${biomarker} NSCLC` }),
    plan({
      "query.cond": "non-small cell lung cancer",
      "query.intr": "amivantamab OR mobocertinib OR sunvozertinib OR zipalertinib",
    }),
  ];
}

function plan(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    ...values,
    "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING",
    pageSize: "20",
    format: "json",
  });
}

async function fetchStudies(params: URLSearchParams): Promise<CtStudy[]> {
  const response = await fetch(
    `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok) throw new Error(`ClinicalTrials.gov ${response.status}`);
  const json = (await response.json()) as { studies?: CtStudy[] };
  return json.studies ?? [];
}

function dedupeStudies(studies: CtStudy[]): CtStudy[] {
  const seen = new Set<string>();
  return studies.filter((study) => {
    const id = study.protocolSection?.identificationModule?.nctId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeStudy(study: CtStudy, patient: PatientProfile): TrialCard | undefined {
  const section = study.protocolSection;
  const id = section?.identificationModule?.nctId;
  const title = section?.identificationModule?.briefTitle;
  if (!id || !title) return undefined;
  const criteria = section?.eligibilityModule?.eligibilityCriteria ?? "";
  const haystack = [
    title,
    section?.designModule?.studyType,
    ...(section?.conditionsModule?.conditions ?? []),
    ...(section?.armsInterventionsModule?.interventions ?? []).map((item) => item.name),
    criteria,
  ].join(" ").toLowerCase();
  if (!isPotentialMatch(patient, haystack)) return undefined;
  return {
    nctId: id,
    title,
    status: section?.statusModule?.overallStatus ?? "Unknown",
    phase: section?.designModule?.phases?.join(", "),
    locations: toLocations(section?.contactsLocationsModule?.locations),
    distanceMiles: estimateDistance(section?.contactsLocationsModule?.locations ?? []),
    matchedCriteria: buildMatches(patient, criteria, haystack),
    missingCriteria: buildMissing(patient, criteria),
    exclusionRisks: buildRisks(criteria),
    coordinatorQuestions: buildQuestions(criteria),
    sourceUrl: `https://clinicaltrials.gov/study/${id}`,
    source: "clinicaltrials.gov",
  };
}

function isPotentialMatch(patient: PatientProfile, haystack: string): boolean {
  const hasDisease = /non-small|nsclc|lung cancer/.test(haystack);
  const hasBiomarker = patient.biomarkers.some((marker) =>
    marker.toLowerCase().split(/\s+/).some((part) => part.length > 3 && haystack.includes(part)),
  );
  return hasDisease || hasBiomarker;
}

function toLocations(locations?: TrialLocation[]): TrialLocation[] {
  return (locations ?? []).slice(0, 4).map((location) => ({
    facility: location.facility,
    city: location.city,
    state: location.state,
    country: location.country,
  }));
}

function estimateDistance(locations: TrialLocation[]): number | undefined {
  const bayArea = locations.find((location) =>
    ["san francisco", "stanford", "palo alto"].some((city) =>
      `${location.city ?? ""} ${location.facility ?? ""}`.toLowerCase().includes(city),
    ),
  );
  if (!bayArea) return undefined;
  return (bayArea.city ?? "").toLowerCase().includes("san francisco") ? 4 : 35;
}

function buildMatches(patient: PatientProfile, criteria: string, haystack: string): string[] {
  return unique([
    /non-small|nsclc|lung cancer/.test(haystack) ? "Non-small cell lung cancer context" : undefined,
    /exon 20|egfr/.test(haystack) ? patient.biomarkers[0] : undefined,
    /platinum/i.test(criteria) ? "Prior platinum therapy appears relevant" : undefined,
    /interventional/i.test(haystack) ? "Interventional study record" : undefined,
  ]);
}

function buildMissing(patient: PatientProfile, criteria: string): string[] {
  const lower = criteria.toLowerCase();
  return unique([
    lower.includes("ecog") ? "ECOG performance status" : undefined,
    lower.includes("creatinine") || lower.includes("organ function") ? "latest creatinine clearance" : undefined,
    lower.includes("brain") || lower.includes("cns") ? "brain metastases stability" : undefined,
    ...patient.missingDataHints,
  ]).slice(0, 6);
}

function buildRisks(criteria: string): string[] {
  const lower = criteria.toLowerCase();
  return unique([
    lower.includes("cns") || lower.includes("brain") ? "CNS disease criteria need study-team review" : undefined,
    lower.includes("washout") ? "Prior therapy washout timing may matter" : undefined,
    lower.includes("organ function") ? "Adequate organ function labs need confirmation" : undefined,
  ]);
}

function buildQuestions(criteria: string): string[] {
  const hasBiopsy = /biopsy|tissue|specimen/i.test(criteria);
  return [
    hasBiopsy ? "Does screening require fresh biopsy, or is archival tissue acceptable?" : "What pathology and genomics documentation is needed?",
    "What is the expected screening timeline and visit cadence?",
    "Are travel, parking, or lodging supports available?",
  ];
}

function isActiveTrial(trial: TrialCard): boolean {
  return /RECRUITING|NOT_YET_RECRUITING|ACTIVE_NOT_RECRUITING/i.test(trial.status);
}

function rankTrials(trials: TrialCard[], patient: PatientProfile): TrialCard[] {
  return [...trials].sort((a, b) => scoreTrial(b, patient) - scoreTrial(a, patient)).slice(0, 5);
}

function scoreTrial(trial: TrialCard, patient: PatientProfile): number {
  return trial.matchedCriteria.length * 3 +
    (trial.distanceMiles !== undefined && trial.distanceMiles <= patient.maxTravelMiles ? 3 : 0) +
    (/RECRUITING/i.test(trial.status) ? 4 : 0) +
    (/exon 20|EGFR/i.test(`${trial.title} ${trial.matchedCriteria.join(" ")}`) ? 4 : 0);
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
