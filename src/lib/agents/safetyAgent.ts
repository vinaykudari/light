import { applyMedicalSafety } from "@/lib/safety/medicalSafety";
import type { GeneratedArtifact, PatientVoiceTheme } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runSafetyAgent(
  context: AgentContext,
  artifacts: GeneratedArtifact[],
  themes: PatientVoiceTheme[],
): Promise<{ artifacts: GeneratedArtifact[]; themes: PatientVoiceTheme[] }> {
  await context.emit("safety", "running", "Applying medical safety checks", "Safety agent removes advice language, final eligibility claims, recommendations, and social identifiers.");
  const safeArtifacts = artifacts.map((artifact) => ({
    ...artifact,
    content: applyMedicalSafety(artifact.content),
  }));
  const safeThemes = themes.map((theme) => ({
    ...theme,
    summary: applyMedicalSafety(theme.summary),
    coordinatorQuestion: applyMedicalSafety(theme.coordinatorQuestion),
  }));
  await context.emit("safety", "completed", "Safety review complete", "Outputs are labeled for education and clinician or study-team review.");
  return { artifacts: safeArtifacts, themes: safeThemes };
}
