import type { GeneratedArtifact, BurdenAnalysis } from "./artifact";
import type { PatientProfile } from "./patient";
import type { ResearchSummary } from "./research";
import type { TrialCard, EligibilityRow } from "./trial";
import type { PatientVoiceTheme } from "./voice";

export type AgentName =
  | "system"
  | "trial"
  | "research"
  | "patient_voice"
  | "eligibility"
  | "burden"
  | "synthesis"
  | "safety";

export type EventStatus = "queued" | "running" | "completed" | "failed";

export type SourceMode = "real" | "mixed" | "mock";

export type AgentEvent = {
  id: string;
  runId: string;
  agent: AgentName;
  status: EventStatus;
  title: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
};

export type CapabilityReport = {
  clinicalTrials: boolean;
  pubMed: boolean;
  xPublicSearch: boolean;
  nia: boolean;
  tensorlake: boolean;
  hyperspell: boolean;
  llm: boolean;
};

export type RunStatus = "created" | "running" | "completed" | "failed";

export type TrialIntelligenceState = {
  runId: string;
  status: RunStatus;
  sourceMode: SourceMode;
  patient: PatientProfile;
  capabilities: CapabilityReport;
  events: AgentEvent[];
  trials: TrialCard[];
  research?: ResearchSummary;
  patientVoice: PatientVoiceTheme[];
  eligibility: EligibilityRow[];
  burden?: BurdenAnalysis;
  artifacts: GeneratedArtifact[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};
