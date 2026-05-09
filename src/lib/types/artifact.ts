export type GeneratedArtifactKind =
  | "patient_briefing"
  | "clinician_checklist"
  | "coordinator_email"
  | "missing_data_checklist";

export type GeneratedArtifact = {
  runId: string;
  kind: GeneratedArtifactKind;
  title: string;
  content: string;
};

export type BurdenAnalysis = {
  flags: string[];
  preferenceMatches: string[];
  coordinatorQuestions: string[];
};
