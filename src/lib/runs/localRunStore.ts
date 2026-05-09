import { seedPatient } from "@/lib/demo/seedPatient";
import type { PatientProfile, PatientProfileInput, TrialIntelligenceState } from "@/lib/types";
import { makeRunId } from "@/lib/workflows/emitEvent";
import { runTrialIntelligence } from "@/lib/workflows/runTrialIntelligence";

const runs = new Map<string, TrialIntelligenceState>();

export function listRuns(): TrialIntelligenceState[] {
  return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRun(runId: string): TrialIntelligenceState | undefined {
  return runs.get(runId);
}

export function startRun(input: Partial<PatientProfileInput>): TrialIntelligenceState {
  const patient = normalizePatient(input);
  const created = new Date().toISOString();
  const placeholder: TrialIntelligenceState = {
    runId: makeRunId(),
    status: "created",
    sourceMode: "mixed",
    patient,
    capabilities: {
      clinicalTrials: true,
      pubMed: true,
      xPublicSearch: false,
      nia: false,
      tensorlake: false,
      hyperspell: false,
      llm: false,
    },
    events: [],
    trials: [],
    patientVoice: [],
    eligibility: [],
    artifacts: [],
    createdAt: created,
    updatedAt: created,
  };
  runs.set(placeholder.runId, placeholder);
  void runTrialIntelligence(patient, (state) => {
    runs.set(state.runId, state);
  }, placeholder.runId).catch((error) => {
    const failed = runs.get(placeholder.runId);
    if (failed) {
      failed.status = "failed";
      failed.error = error instanceof Error ? error.message : "Unknown run error";
      failed.updatedAt = new Date().toISOString();
    }
  });
  return placeholder;
}

export async function runNow(input: Partial<PatientProfileInput>): Promise<TrialIntelligenceState> {
  const patient = normalizePatient(input);
  let latest: TrialIntelligenceState | undefined;
  const completed = await runTrialIntelligence(patient, (state) => {
    latest = state;
  });
  return latest ?? completed;
}

function normalizePatient(input: Partial<PatientProfileInput>): PatientProfile {
  return {
    ...seedPatient,
    ...input,
    id: input.id || seedPatient.id,
    biomarkers: normalizeList(input.biomarkers, seedPatient.biomarkers),
    priorTherapies: normalizeList(input.priorTherapies, seedPatient.priorTherapies),
    preferences: normalizeList(input.preferences, seedPatient.preferences),
    missingDataHints: normalizeList(input.missingDataHints, seedPatient.missingDataHints),
    maxTravelMiles: Number(input.maxTravelMiles || seedPatient.maxTravelMiles),
  };
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return fallback;
}
