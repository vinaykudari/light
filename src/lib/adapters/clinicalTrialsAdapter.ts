import { seedTrials } from "@/lib/demo/seedTrials";
import type { PatientProfile, TrialCard, TrialLocation } from "@/lib/types";

type SearchResult = {
  trials: TrialCard[];
  sourceMode: "real" | "mock";
  message?: string;
};

type CtStudy = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string };
    designModule?: { phases?: string[]; studyType?: string };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: { interventions?: Array<{ name?: string }> };
    eligibilityModule?: { eligibilityCriteria?: string };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        country?: string;
      }>;
    };
  };
};

export async function searchClinicalTrials(patient: PatientProfile): Promise<SearchResult> {
  const query = [
    patient.diagnosis,
    ...patient.biomarkers,
    "recruiting interventional",
  ].join(" ");
  const params = new URLSearchParams({
    "query.term": query,
    "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING",
    pageSize: "12",
    format: "json",
  });

  try {
    const response = await fetch(
      `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`,
      { next: { revalidate: 3600 } },
    );
    if (!response.ok) throw new Error(`ClinicalTrials.gov ${response.status}`);
    const json = (await response.json()) as { studies?: CtStudy[] };
    const trials = (json.studies ?? [])
      .map((study) => normalizeStudy(study, patient))
      .filter(Boolean)
      .slice(0, 5) as TrialCard[];
    const ranked = rankTrials(trials, patient);
    if (ranked.length === 0) {
      return { trials: seedTrials, sourceMode: "mock", message: "No matching official trial records found, using seeded demo data" };
    }
    return { trials: ranked, sourceMode: "real" };
  } catch (error) {
    return {
      trials: seedTrials,
      sourceMode: "mock",
      message: `ClinicalTrials.gov unavailable, using seeded demo data: ${safeError(error)}`,
    };
  }
}

function normalizeStudy(study: CtStudy, patient: PatientProfile): TrialCard | undefined {
  const section = study.protocolSection;
  const id = section?.identificationModule?.nctId;
  const title = section?.identificationModule?.briefTitle;
  if (!id || !title) return undefined;
  const criteria = section?.eligibilityModule?.eligibilityCriteria ?? "";
  const haystack = [
    title,
    ...(section?.conditionsModule?.conditions ?? []),
    ...(section?.armsInterventionsModule?.interventions ?? []).map((item) => item.name),
    criteria,
  ].join(" ").toLowerCase();
  const hasDisease = patient.diagnosis
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .some((word) => haystack.includes(word.toLowerCase()));
  const hasBiomarker = patient.biomarkers.some((marker) =>
    marker.toLowerCase().split(/\s+/).some((part) => part.length > 3 && haystack.includes(part)),
  );
  if (!hasDisease && !hasBiomarker) return undefined;

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

function toLocations(locations?: TrialLocation[]): TrialLocation[] {
  return (locations ?? []).slice(0, 3).map((location) => ({
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
  if ((bayArea.city ?? "").toLowerCase().includes("san francisco")) return 4;
  return 35;
}

function buildMatches(patient: PatientProfile, criteria: string, haystack: string): string[] {
  return [
    haystack.includes("non-small") || haystack.includes("nsclc") ? "Non-small cell lung cancer context" : undefined,
    patient.biomarkers.find((marker) => haystack.includes(marker.toLowerCase().split(" ")[0])),
    criteria.toLowerCase().includes("platinum") ? "Prior platinum therapy appears relevant" : undefined,
  ].filter(Boolean) as string[];
}

function buildMissing(patient: PatientProfile, criteria: string): string[] {
  const lower = criteria.toLowerCase();
  const inferred = [
    lower.includes("ecog") ? "ECOG performance status" : undefined,
    lower.includes("creatinine") || lower.includes("organ function") ? "latest creatinine clearance" : undefined,
    lower.includes("brain") || lower.includes("cns") ? "brain metastases stability" : undefined,
  ].filter(Boolean) as string[];
  return [...new Set([...inferred, ...patient.missingDataHints])].slice(0, 5);
}

function buildRisks(criteria: string): string[] {
  const lower = criteria.toLowerCase();
  return [
    lower.includes("cns") || lower.includes("brain") ? "CNS disease criteria need study-team review" : undefined,
    lower.includes("washout") ? "Prior therapy washout timing may matter" : undefined,
    lower.includes("organ function") ? "Adequate organ function labs need confirmation" : undefined,
  ].filter(Boolean) as string[];
}

function buildQuestions(criteria: string): string[] {
  const hasBiopsy = /biopsy|tissue|specimen/i.test(criteria);
  return [
    hasBiopsy ? "Does screening require fresh biopsy, or is archival tissue acceptable?" : "What pathology and genomics documentation is needed?",
    "What is the expected screening timeline and visit cadence?",
    "Are travel, parking, or lodging supports available?",
  ];
}

function rankTrials(trials: TrialCard[], patient: PatientProfile): TrialCard[] {
  return [...trials].sort((a, b) => scoreTrial(b, patient) - scoreTrial(a, patient)).slice(0, 5);
}

function scoreTrial(trial: TrialCard, patient: PatientProfile): number {
  return trial.matchedCriteria.length * 3 +
    (trial.distanceMiles !== undefined && trial.distanceMiles <= patient.maxTravelMiles ? 3 : 0) +
    (/recruiting/i.test(trial.status) ? 2 : 0);
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
