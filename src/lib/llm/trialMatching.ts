import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { PatientProfile, TrialCard } from "@/lib/types";

export type TrialSearchPlan = {
  queries: Array<{ condition?: string; term: string }>;
};

type TrialRanking = {
  ranked: Array<{
    nctId: string;
    relevanceReason?: string;
    matchedCriteria?: string[];
    missingCriteria?: string[];
    exclusionRisks?: string[];
    coordinatorQuestions?: string[];
  }>;
};

export async function buildTrialSearchPlan(patient: PatientProfile): Promise<TrialSearchPlan> {
  const fallback = fallbackPlan(patient);
  const prompt = [
    "Create live ClinicalTrials.gov search queries for a patient symptom or diagnosis profile.",
    "Return only JSON: {\"queries\":[{\"condition\":\"optional condition\",\"term\":\"search terms\"}]}",
    "Use concise condition names and trial-search synonyms. Prefer condition as a short disease concept, not a full sentence. Do not include NCT IDs. Do not assume eligibility.",
    "For every query, condition and term together should be broad enough to retrieve active official trial records.",
    `Patient: ${JSON.stringify(patient)}`,
  ].join("\n");
  const result = await generateStructured<TrialSearchPlan>(prompt, fallback);
  return normalizePlan(result.value, fallback);
}

export async function rankTrialsWithLlm(patient: PatientProfile, trials: TrialCard[]): Promise<TrialCard[]> {
  if (!trials.length) return trials;
  const fallback: TrialRanking = { ranked: trials.map((trial) => ({ nctId: trial.nctId })) };
  const prompt = [
    "Rank official ClinicalTrials.gov trial records for potential clinician/study-team review.",
    "Return only JSON: {\"ranked\":[{\"nctId\":\"...\",\"relevanceReason\":\"...\",\"matchedCriteria\":[],\"missingCriteria\":[],\"exclusionRisks\":[],\"coordinatorQuestions\":[]}]}",
    "Use only the supplied trial records. Never say eligible, enroll, best, safe, or recommend treatment.",
    `Patient: ${JSON.stringify(patient)}`,
    `Trials: ${JSON.stringify(trials.slice(0, 20).map(compactTrial))}`,
  ].join("\n");
  const result = await generateStructured<TrialRanking>(prompt, fallback);
  const byId = new Map(trials.map((trial) => [trial.nctId, trial]));
  const ranked = Array.isArray(result.value.ranked) ? result.value.ranked : fallback.ranked;
  const hydrated = ranked.flatMap((item) => {
    const trial = byId.get(item.nctId);
    if (!trial) return [];
    return [{
      ...trial,
      matchedCriteria: list(item.matchedCriteria, trial.matchedCriteria),
      missingCriteria: list(item.missingCriteria, trial.missingCriteria),
      exclusionRisks: list(item.exclusionRisks, trial.exclusionRisks),
      coordinatorQuestions: list(item.coordinatorQuestions, trial.coordinatorQuestions),
    }];
  });
  const remaining = trials.filter((trial) => !hydrated.some((item) => item.nctId === trial.nctId));
  return [...hydrated, ...remaining].slice(0, 5);
}

function fallbackPlan(patient: PatientProfile): TrialSearchPlan {
  const condition = shortCondition(patient.possibleConditionContext ?? patient.diagnosis);
  const symptoms = [...(patient.symptoms ?? []), ...patient.biomarkers].slice(0, 8).join(" ");
  return {
    queries: [
      { condition, term: symptoms || condition },
      { term: `${condition} ${symptoms} clinical trial research study` },
      { term: `${condition} ${symptoms} patient reported outcomes` },
    ],
  };
}

function normalizePlan(plan: TrialSearchPlan, fallback: TrialSearchPlan): TrialSearchPlan {
  const queries = Array.isArray(plan.queries) ? plan.queries : fallback.queries;
  return {
    queries: queries
      .map((query) => ({
        condition: clean(query.condition ? shortCondition(query.condition) : undefined),
        term: clean(query.term) ?? "",
      }))
      .filter((query) => query.term)
      .slice(0, 5),
  };
}

function compactTrial(trial: TrialCard) {
  return {
    nctId: trial.nctId,
    title: trial.title,
    status: trial.status,
    phase: trial.phase,
    locations: trial.locations,
    matchedCriteria: trial.matchedCriteria,
    missingCriteria: trial.missingCriteria,
    exclusionRisks: trial.exclusionRisks,
    coordinatorQuestions: trial.coordinatorQuestions,
  };
}

function list(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8) : fallback;
}

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function shortCondition(condition: string): string {
  const first = condition.split(/[(/,;]/)[0]?.trim();
  return first || condition;
}
