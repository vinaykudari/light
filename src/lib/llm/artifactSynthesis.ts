import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { BurdenAnalysis, EligibilityRow, GeneratedArtifact, PatientProfile, PatientVoiceTheme, ResearchSummary, TrialCard } from "@/lib/types";

type ArtifactDrafts = {
  patientBriefing: string;
  clinicianChecklist: string;
  coordinatorEmail: string;
  missingDataChecklist: string;
};

export async function buildArtifactsWithLlm(
  runId: string,
  patient: PatientProfile,
  input: {
    trials: TrialCard[];
    research: ResearchSummary;
    patientVoice: PatientVoiceTheme[];
    eligibility: EligibilityRow[];
    burden: BurdenAnalysis;
  },
): Promise<GeneratedArtifact[]> {
  const fallback = fallbackDrafts(patient, input);
  const prompt = [
    "Generate Light clinical-trial discussion-prep artifacts from live source data.",
    "Return only JSON with string keys: patientBriefing, clinicianChecklist, coordinatorEmail, missingDataChecklist.",
    "Use the supplied trial, research, patient voice, eligibility, and burden data. Do not invent trials, papers, posts, usernames, diagnoses, eligibility, safety, or treatment recommendations.",
    "Required wording: education and clinician-reviewed referral preparation only; final eligibility must be confirmed by the study team.",
    `Patient: ${JSON.stringify(patient)}`,
    `Input: ${JSON.stringify(input)}`,
  ].join("\n");
  const result = await generateStructured<ArtifactDrafts>(prompt, fallback);
  const drafts = normalizeDrafts(result.value, fallback);
  return [
    artifact(runId, "patient_briefing", `Light Briefing: ${patient.possibleConditionContext ?? patient.diagnosis} Trial Discussion Prep`, drafts.patientBriefing),
    artifact(runId, "clinician_checklist", "Clinician Checklist", drafts.clinicianChecklist),
    artifact(runId, "coordinator_email", "Coordinator Email Draft", drafts.coordinatorEmail),
    artifact(runId, "missing_data_checklist", "Missing-Data Checklist", drafts.missingDataChecklist),
  ];
}

function fallbackDrafts(patient: PatientProfile, input: {
  trials: TrialCard[];
  research: ResearchSummary;
  patientVoice: PatientVoiceTheme[];
  eligibility: EligibilityRow[];
  burden: BurdenAnalysis;
}): ArtifactDrafts {
  const condition = patient.possibleConditionContext ?? patient.diagnosis;
  const safety = "This is for education and clinician-reviewed referral preparation only. Light does not diagnose, recommend treatment, or determine trial eligibility. Final eligibility must be confirmed by the study team.";
  return {
    patientBriefing: [
      `Light Briefing: ${condition} Trial Discussion Prep`,
      `Reported symptoms/context: ${(patient.symptoms ?? []).join(", ") || condition}.`,
      `Live trial records retained: ${input.trials.map((trial) => `${trial.nctId}: ${trial.title}`).join("; ") || "none"}.`,
      `Research themes: ${input.research.themes.join("; ") || "none"}.`,
      `Public patient-experience themes: ${input.patientVoice.map((theme) => theme.theme).join("; ") || "none"}.`,
      safety,
    ].join("\n\n"),
    clinicianChecklist: [
      `Condition context: ${condition}`,
      `Missing data: ${input.eligibility.flatMap((row) => row.missingData).join("; ") || patient.missingDataHints.join("; ")}`,
      `Research questions: ${input.research.clinicianQuestions.join("; ")}`,
      safety,
    ].join("\n\n"),
    coordinatorEmail: [
      `Subject: Pre-screening guidance question for ${condition} research study`,
      "Hello,",
      `I am preparing a clinician-reviewed referral-prep question for a de-identified profile in ${patient.location}.`,
      `Potentially relevant trial context: ${input.trials[0] ? `${input.trials[0].nctId}: ${input.trials[0].title}` : "live search did not retain a trial"}.`,
      `Questions: ${input.burden.coordinatorQuestions.join("; ")}`,
      "Final eligibility would need study-team confirmation.",
    ].join("\n\n"),
    missingDataChecklist: [
      "Missing information to collect before referral review:",
      ...new Set([...patient.missingDataHints, ...input.eligibility.flatMap((row) => row.missingData)]),
      safety,
    ].join("\n- "),
  };
}

function normalizeDrafts(value: ArtifactDrafts, fallback: ArtifactDrafts): ArtifactDrafts {
  return {
    patientBriefing: text(value.patientBriefing) ?? fallback.patientBriefing,
    clinicianChecklist: text(value.clinicianChecklist) ?? fallback.clinicianChecklist,
    coordinatorEmail: text(value.coordinatorEmail) ?? fallback.coordinatorEmail,
    missingDataChecklist: text(value.missingDataChecklist) ?? fallback.missingDataChecklist,
  };
}

function artifact(runId: string, kind: GeneratedArtifact["kind"], title: string, content: string): GeneratedArtifact {
  return { runId, kind, title, content };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
