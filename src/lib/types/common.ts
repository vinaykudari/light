export type IsoDate = string;
export type IsoDateTime = string;
export type UriString = string;

export type PatientId = string;
export type TrialId = string;
export type ResearchId = string;
export type VoiceSessionId = string;
export type RunId = string;
export type ArtifactId = string;

export type ConfidenceLevel = "low" | "medium" | "high";
export type EvidenceGrade = "unknown" | "very_low" | "low" | "moderate" | "high";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ClinicalCodeSystem =
  | "icd10"
  | "snomed"
  | "loinc"
  | "rxnorm"
  | "nct"
  | "orpha"
  | "other";

export type ClinicalCode = {
  system: ClinicalCodeSystem;
  code: string;
  label?: string;
};

export type SourceKind =
  | "trial_registry"
  | "publication"
  | "guideline"
  | "patient_report"
  | "model"
  | "internal";

export type SourceReference = {
  id: string;
  kind: SourceKind;
  title?: string;
  url?: UriString;
  retrievedAt?: IsoDateTime;
  publishedAt?: IsoDate;
};

export type ActorKind = "patient" | "clinician" | "researcher" | "system" | "agent";

export type ActorRef = {
  id: string;
  kind: ActorKind;
  displayName?: string;
};

export type AuditFields = {
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
  createdBy?: ActorRef;
  updatedBy?: ActorRef;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Scored<T> = {
  item: T;
  score: number;
  confidence: ConfidenceLevel;
};
