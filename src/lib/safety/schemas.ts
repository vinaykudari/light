import { z } from "zod";

export const SafetyCategorySchema = z.enum([
  "medicalAdvice",
  "treatmentRecommendation",
  "finalEligibilityClaim",
  "profileData",
  "phi",
]);

export const SafetyFindingSchema = z.object({
  category: SafetyCategorySchema,
  reason: z.string(),
  blocking: z.boolean(),
});

export const SafetyFilterResultSchema = z.object({
  allowed: z.boolean(),
  redacted: z.boolean(),
  categories: z.array(SafetyCategorySchema),
  findings: z.array(SafetyFindingSchema),
  safeText: z.string(),
  message: z.string().optional(),
});

export type SafetyCategory = z.infer<typeof SafetyCategorySchema>;
export type SafetyFinding = z.infer<typeof SafetyFindingSchema>;
export type SafetyFilterResult = z.infer<typeof SafetyFilterResultSchema>;
