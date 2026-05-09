import { applyMedicalSafety } from "@/lib/safety/medicalSafety";
import { summarizePatientVoice } from "@/lib/synthesis/summarizePatientVoice";
import { summarizeResearch } from "@/lib/synthesis/summarizeResearch";
import type {
  BurdenAnalysis,
  EligibilityRow,
  GeneratedArtifact,
  PatientProfile,
  PatientVoiceTheme,
  ResearchSummary,
  TrialCard,
} from "@/lib/types";

type ArtifactInput = {
  trials: TrialCard[];
  research: ResearchSummary;
  patientVoice: PatientVoiceTheme[];
  eligibility: EligibilityRow[];
  burden: BurdenAnalysis;
};

export function buildArtifacts(
  runId: string,
  patient: PatientProfile,
  input: ArtifactInput,
): GeneratedArtifact[] {
  return [
    artifact(runId, "patient_briefing", "Patient-Friendly Briefing", patientBriefing(patient, input)),
    artifact(runId, "clinician_checklist", "Clinician Checklist", clinicianChecklist(patient, input)),
    artifact(runId, "coordinator_email", "Coordinator Email Draft", coordinatorEmail(patient, input)),
    artifact(runId, "missing_data_checklist", "Missing-Data Checklist", missingDataChecklist(input)),
  ];
}

function patientBriefing(patient: PatientProfile, input: ArtifactInput): string {
  const trialLines = input.trials.slice(0, 3).map((trial) =>
    `- ${trial.nctId}: ${trial.title}. This appears potentially relevant and needs clinician/study-team review.`,
  );
  return [
    `Light searched clinical trial records, research context, and unverified public patient-experience signals for a synthetic profile with ${patient.diagnosis} and ${patient.biomarkers.join(", ")}.`,
    "This is for education and referral preparation only. It is not medical advice and does not determine trial eligibility.",
    "",
    "Potentially Relevant Trials:",
    ...trialLines,
    "",
    "What Is Missing:",
    ...unique(input.eligibility.flatMap((row) => row.missingData)).map((item) => `- ${item}`),
    "",
    "Questions To Ask:",
    ...unique(input.burden.coordinatorQuestions).map((item) => `- ${item}`),
  ].join("\n");
}

function clinicianChecklist(patient: PatientProfile, input: ArtifactInput): string {
  return [
    "Use this checklist for clinician-reviewed referral preparation only.",
    "",
    "Patient Context:",
    `- Diagnosis: ${patient.diagnosis}`,
    `- Biomarker: ${patient.biomarkers.join(", ")}`,
    `- Prior therapy: ${patient.priorTherapies.join(", ")}`,
    "",
    "Documents To Collect:",
    "- Pathology report",
    "- Genomics report confirming EGFR exon 20 insertion",
    "- Latest labs including creatinine clearance",
    "- Brain MRI or stability documentation if relevant",
    "- Prior therapy dates and response history",
    "",
    "Criteria To Verify:",
    ...unique(input.eligibility.flatMap((row) => [...row.missingData, ...row.possibleExclusionRisks])).map((item) => `- ${item}`),
    "",
    "Research Context:",
    summarizeResearch(input.research),
  ].join("\n");
}

function coordinatorEmail(patient: PatientProfile, input: ArtifactInput): string {
  const trial = input.trials[0];
  return [
    "Subject: Pre-screening question for synthetic EGFR exon 20 NSCLC profile",
    "",
    "Hello,",
    "",
    `I am preparing a clinician-reviewed referral question for a synthetic/de-identified profile with ${patient.diagnosis}, ${patient.biomarkers.join(", ")}, and prior ${patient.priorTherapies.join(", ")}.`,
    trial ? `The trial of interest is ${trial.nctId}: ${trial.title}.` : "We are reviewing potentially relevant trials.",
    "Could your team advise what information is needed for pre-screening guidance?",
    "",
    "Missing or to-confirm information:",
    ...unique(input.eligibility.flatMap((row) => row.missingData)).slice(0, 6).map((item) => `- ${item}`),
    "",
    "Questions:",
    ...unique(input.burden.coordinatorQuestions).slice(0, 5).map((item) => `- ${item}`),
    "",
    "Final eligibility would need study-team confirmation.",
  ].join("\n");
}

function missingDataChecklist(input: ArtifactInput): string {
  return [
    "Missing information to collect before referral review:",
    "- ECOG performance status",
    "- Latest labs, including creatinine clearance",
    "- Brain MRI and stability documentation",
    "- Pathology report",
    "- Genomics report confirming EGFR exon 20 insertion",
    "- Prior therapy names, dates, response, and washout timing",
    ...unique(input.eligibility.flatMap((row) => row.missingData)).map((item) => `- ${item}`),
    "",
    "Patient Voice Context:",
    summarizePatientVoice(input.patientVoice),
  ].join("\n");
}

function artifact(
  runId: string,
  kind: GeneratedArtifact["kind"],
  title: string,
  content: string,
): GeneratedArtifact {
  return { runId, kind, title, content: applyMedicalSafety(content) };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
