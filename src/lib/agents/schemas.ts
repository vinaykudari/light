import { z } from "zod";
import { SafetyFilterResultSchema } from "@/lib/safety";

export const AgentNameSchema = z.enum([
  "trial",
  "research",
  "patientVoice",
  "eligibility",
  "burden",
  "safety",
]);

export const FindingStatusSchema = z.enum([
  "supported",
  "uncertain",
  "risk",
  "missing",
  "neutral",
]);

export const EvidenceSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
  text: z.string().default(""),
});

export const PatientVoiceSourceSchema = z.object({
  id: z.string().min(1),
  sourceType: z.string().default("patient-reported source"),
  text: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export const TrialRecordSchema = z.object({
  nctId: z.string().optional(),
  title: z.string().optional(),
  condition: z.string().optional(),
  phase: z.string().optional(),
  intervention: z.string().optional(),
  summary: z.string().optional(),
  inclusionCriteria: z.array(z.string()).default([]),
  exclusionCriteria: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  visits: z.string().optional(),
});

export const EligibilityFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().optional(),
  source: z.string().optional(),
});

export const LightCaseInputSchema = z.object({
  question: z.string().default(""),
  condition: z.string().optional(),
  trial: TrialRecordSchema.optional(),
  research: z.array(EvidenceSourceSchema).default([]),
  patientVoice: z.array(PatientVoiceSourceSchema).default([]),
  facts: z.array(EligibilityFactSchema).default([]),
  burdenPreferences: z.array(z.string()).default([]),
});

export const AgentFindingSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: FindingStatusSchema,
  detail: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});

export const AgentOutputSchema = z.object({
  agent: AgentNameSchema,
  mode: z.literal("mock_safe"),
  generatedAt: z.literal("deterministic-mock"),
  prompt: z.string(),
  summary: z.string(),
  findings: z.array(AgentFindingSchema),
  caveats: z.array(z.string()),
  safety: SafetyFilterResultSchema,
});

export type AgentName = z.infer<typeof AgentNameSchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type LightCaseInput = z.input<typeof LightCaseInputSchema>;
export type NormalizedLightCaseInput = z.infer<typeof LightCaseInputSchema>;
export type AgentFinding = z.infer<typeof AgentFindingSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
