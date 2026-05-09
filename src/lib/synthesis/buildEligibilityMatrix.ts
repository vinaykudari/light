import { applyMedicalSafety } from "@/lib/safety/medicalSafety";
import type { EligibilityRow, PatientProfile, TrialCard } from "@/lib/types";

export function buildEligibilityMatrix(
  patient: PatientProfile,
  trials: TrialCard[],
): EligibilityRow[] {
  return trials.map((trial) => ({
    trialId: trial.nctId,
    trialTitle: trial.title,
    matchedCriteria: unique([
      ...trial.matchedCriteria,
      patient.biomarkers.length ? `Profile includes ${patient.biomarkers.join(", ")}` : undefined,
      patient.priorTherapies.length ? `Prior therapy noted: ${patient.priorTherapies.join(", ")}` : undefined,
    ]).map(applyMedicalSafety),
    missingData: unique([...trial.missingCriteria, ...patient.missingDataHints]).map(applyMedicalSafety),
    possibleExclusionRisks: unique(trial.exclusionRisks).map(applyMedicalSafety),
    reviewNote: "Potentially relevant for clinician and study-team review; Light does not determine final eligibility.",
  }));
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])].slice(0, 8);
}
