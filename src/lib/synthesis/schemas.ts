import { z } from "zod";
import { AgentOutputSchema, LightCaseInputSchema } from "@/lib/agents/schemas";
import { SafetyFilterResultSchema } from "@/lib/safety";

export const generatedArtifactSchema = z.object({
  kind: z.enum([
    "patient_briefing",
    "clinician_checklist",
    "coordinator_email",
    "missing_data_checklist",
  ]),
  title: z.string(),
  content: z.string(),
});

export const eligibilityRowSchema = z.object({
  trialId: z.string(),
  trialTitle: z.string(),
  matchedCriteria: z.array(z.string()),
  missingData: z.array(z.string()),
  possibleExclusionRisks: z.array(z.string()),
  reviewNote: z.string(),
});

export const SynthesisSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

export const SynthesisInputSchema = z.object({
  caseInput: LightCaseInputSchema,
  agentOutputs: z.array(AgentOutputSchema).default([]),
});

export const SynthesisOutputSchema = z.object({
  agent: z.literal("synthesis"),
  mode: z.literal("mock_safe"),
  generatedAt: z.literal("deterministic-mock"),
  prompt: z.string(),
  summary: z.string(),
  sections: z.array(SynthesisSectionSchema),
  nextQuestions: z.array(z.string()),
  caveats: z.array(z.string()),
  safety: SafetyFilterResultSchema,
});

export type SynthesisSection = z.infer<typeof SynthesisSectionSchema>;
export type SynthesisInput = z.input<typeof SynthesisInputSchema>;
export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
