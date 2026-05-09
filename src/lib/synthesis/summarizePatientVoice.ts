import { applyMedicalSafety } from "@/lib/safety/medicalSafety";
import type { PatientVoiceTheme } from "@/lib/types";

export function summarizePatientVoice(themes: PatientVoiceTheme[]): string {
  return themes
    .map((theme) => [
      `- ${applyMedicalSafety(theme.theme)} (${theme.sentiment}, ${theme.signalStrength} signal, ${theme.sourceCount} sources)`,
      `  ${applyMedicalSafety(theme.summary)}`,
      `  Ask: ${applyMedicalSafety(theme.coordinatorQuestion)}`,
    ].join("\n"))
    .join("\n");
}
