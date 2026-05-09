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
  if (isConversationProfile(patient)) {
    const title = `Light Briefing: ${patient.possibleConditionContext ?? patient.diagnosis} Trial Discussion Prep`;
    return [
      artifact(runId, "patient_briefing", title, conversationBriefing(patient, input)),
      artifact(runId, "clinician_checklist", "Clinician Checklist", conversationClinicianChecklist(patient, input)),
      artifact(runId, "coordinator_email", "Coordinator Email Draft", conversationCoordinatorEmail(patient, input)),
      artifact(runId, "missing_data_checklist", "Missing-Data Checklist", conversationMissingDataChecklist(patient, input)),
    ];
  }
  return [
    artifact(runId, "patient_briefing", "Patient-Friendly Briefing", patientBriefing(patient, input)),
    artifact(runId, "clinician_checklist", "Clinician Checklist", clinicianChecklist(patient, input)),
    artifact(runId, "coordinator_email", "Coordinator Email Draft", coordinatorEmail(patient, input)),
    artifact(runId, "missing_data_checklist", "Missing-Data Checklist", missingDataChecklist(input)),
  ];
}

function conversationBriefing(patient: PatientProfile, input: ArtifactInput): string {
  const symptoms = patient.symptoms ?? [];
  const condition = patient.possibleConditionContext ?? patient.diagnosis;
  return [
    `Light Briefing: ${condition} Trial Discussion Prep`,
    "",
    "1. What the patient described",
    ...symptoms.map((symptom) => `- ${symptom}`),
    `- symptoms started ${patient.onset ?? "after an illness"} and persisted around ${patient.duration ?? "the reported duration"}`,
    "",
    "2. Why this pattern matters",
    ...input.research.themes.map((theme) => `- ${theme}`),
    "",
    "3. Potential trial direction to discuss",
    ...input.trials.slice(0, 4).map((trial) => `- ${trial.nctId}: ${trial.title}. Potentially relevant context only; needs clinician/study-team review.`),
    ...(!input.trials.length ? ["- No official trial match was retained from this live run."] : []),
    "",
    "4. Missing info before referral/pre-screening",
    ...conversationMissingItems(input).map((item) => `- ${item}`),
    "",
    "5. Public patient-experience themes",
    ...input.patientVoice.map((theme) => `- ${theme.theme}: ${theme.summary}`),
    "",
    "6. Questions to ask doctor/coordinator",
    `- Could these symptoms fit a ${condition} research category?`,
    "- Does this trial measure the patient's main symptoms separately?",
    "- What screening tests are required?",
    "- How many visits are in person?",
    "- Can labs be done locally?",
    "- What happens if visits trigger a symptom flare?",
    "- Are travel/reimbursement supports available?",
    "- Who confirms final eligibility?",
    "",
    "7. Safety note",
    "This is for education and clinician-reviewed trial discussion prep only. Light does not diagnose, recommend treatment, or determine trial eligibility. Final eligibility must be confirmed by the study team.",
  ].join("\n");
}

function conversationClinicianChecklist(patient: PatientProfile, input: ArtifactInput): string {
  return [
    "Use this checklist for clinician-reviewed referral preparation only.",
    "",
    `Condition context: ${patient.possibleConditionContext ?? patient.diagnosis}`,
    `Symptoms: ${(patient.symptoms ?? []).join(", ")}`,
    `Duration/onset: ${patient.duration ?? "not stated"}; ${patient.onset ?? "not stated"}`,
    "",
    "Research connection:",
    ...input.research.themes.map((theme) => `- ${theme}`),
    "",
    "Missing or to-confirm:",
    ...conversationMissingItems(input).map((item) => `- ${item}`),
  ].join("\n");
}

function conversationCoordinatorEmail(patient: PatientProfile, input: ArtifactInput): string {
  const trial = input.trials[0];
  const condition = patient.possibleConditionContext ?? patient.diagnosis;
  return [
    `Subject: Pre-screening guidance question for ${condition} research study`,
    "",
    "Hello,",
    "",
    `I am preparing a clinician-reviewed referral question for a synthetic/de-identified profile: ${patient.age ?? "adult"} patient in ${patient.location} with ${condition}, symptoms including ${(patient.symptoms ?? []).join(", ")}, lasting about ${patient.duration ?? "the reported duration"}.`,
    trial ? `The trial being discussed is ${trial.nctId}: ${trial.title}.` : `We are reviewing potentially relevant ${condition} studies.`,
    "Could your team advise what information is needed for pre-screening guidance?",
    "",
    "Questions:",
    ...unique(input.burden.coordinatorQuestions).slice(0, 6).map((item) => `- ${item}`),
    "",
    "Final eligibility would need study-team confirmation.",
  ].join("\n");
}

function conversationMissingDataChecklist(patient: PatientProfile, input: ArtifactInput): string {
  return [
    "Missing information to collect before referral review:",
    ...conversationMissingItems(input).map((item) => `- ${item}`),
    "- objective symptom measures if available",
    "- clinician notes or testing related to orthostatic symptoms",
    "",
    `Patient goal: ${patient.patientGoal ?? "doctor-reviewed trial discussion prep"}`,
    "",
    "Patient Voice Context:",
    summarizePatientVoice(input.patientVoice),
  ].join("\n");
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

function isConversationProfile(patient: PatientProfile): boolean {
  return Boolean(patient.symptoms?.length || patient.possibleConditionContext || patient.patientGoal);
}

function conversationMissingItems(input: ArtifactInput): string[] {
  return unique([
    "age confirmation",
    "symptom duration and onset",
    "medication stability",
    "condition documentation requested by the protocol",
    "hospitalization status if relevant",
    "recent vaccination/medication timing if relevant to criteria",
    "other diagnoses that explain symptoms",
    "willingness/ability for study visits",
    "willingness for blood collection if required",
    ...input.eligibility.flatMap((row) => row.missingData),
  ]).slice(0, 14);
}
