import { loadClinicMemory } from "@/lib/adapters/hyperspellAdapter";
import type { BurdenAnalysis, PatientVoiceTheme, TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runBurdenAgent(
  context: AgentContext,
  trials: TrialCard[],
  themes: PatientVoiceTheme[],
): Promise<BurdenAnalysis> {
  await context.emit("burden", "running", "Estimating practical trial burden", "Agent is reviewing travel, biopsy, visit frequency, reimbursement, and caregiver friction.");
  const memory = await loadClinicMemory(context.patient);
  if (memory.message) {
    await context.emit("burden", "running", "Recalling clinic/team memory", memory.message);
  }
  const flags = buildFlags(context.patient.maxTravelMiles, trials, themes, memory.memories, Boolean(context.patient.symptoms?.length));
  await context.emit("burden", "running", "Checking patient preferences", "Preferences are compared against site distance and common patient-experience themes.");
  const coordinatorQuestions = context.patient.symptoms?.length ? [
    "How many visits are in person, and can any labs or visits be done locally?",
    "What happens if study visits trigger a symptom flare?",
    "Are travel, parking, or reimbursement supports available?",
    "Which patient-reported outcomes, cognitive tests, autonomic tests, or biomarkers are used?",
  ] : [
    "What is the expected screening and first-cycle visit cadence?",
    "Can visits be scheduled on Fridays when clinically appropriate?",
    "Is travel, parking, lodging, or caregiver support available?",
    "Will tissue requirements require a new biopsy or archival samples?",
  ];
  await context.emit("burden", "completed", "Generating logistics questions", `${coordinatorQuestions.length} logistics questions are ready.`);
  return {
    flags,
    preferenceMatches: context.patient.preferences,
    coordinatorQuestions,
  };
}

function buildFlags(
  travelLimit: number,
  trials: TrialCard[],
  themes: PatientVoiceTheme[],
  memories: string[],
  symptomDriven: boolean,
): string[] {
  const farther = trials.filter((trial) => (trial.distanceMiles ?? 0) > travelLimit);
  if (symptomDriven) {
    return [
      farther.length ? `${farther.length} trial location may exceed the stated travel limit.` : "Nearby options are ranked when official location data is available.",
      themes.some((theme) => /crash|post-exertional|flare/i.test(theme.theme)) ? "Symptom flares from visits should be discussed before screening." : "Visit burden should be checked against the patient's energy limits.",
      ...memories.slice(0, 1).map((memory) => `Clinic memory: ${memory}`),
      "Outcome measures should line up with the symptoms the patient actually experiences.",
    ];
  }
  return [
    farther.length ? `${farther.length} trial location may exceed the stated travel limit.` : "Top nearby trial options appear within the stated travel limit when distance is available.",
    themes.some((theme) => /biopsy|tissue/i.test(theme.theme)) ? "Biopsy or tissue requirements should be clarified before referral." : "Tissue requirements should still be confirmed with each coordinator.",
    ...memories.slice(0, 1).map((memory) => `Clinic memory: ${memory}`),
    "Reimbursement and visit cadence should be asked directly because public records often omit this detail.",
  ];
}
