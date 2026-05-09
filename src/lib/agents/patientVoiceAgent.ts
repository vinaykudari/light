import { searchPatientVoice } from "@/lib/adapters/xAdapter";
import type { PatientVoiceTheme } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runPatientVoiceAgent(context: AgentContext): Promise<{
  themes: PatientVoiceTheme[];
  sourceMode: "real" | "mock";
}> {
  await context.emit("patient_voice", "running", "Searching public patient-experience signals", "Public X.com search is limited to non-profile patient-experience terms.");
  const result = await searchPatientVoice(context.patient);
  if (result.message) {
    await context.emit("patient_voice", "running", "Source unavailable, using seeded demo data", result.message);
  }
  await context.emit("patient_voice", "running", "Retrieved public posts", `${result.posts.length} sanitized public or synthetic signals are available.`);
  await context.emit("patient_voice", "running", "Filtering irrelevant posts", "Usernames, links, and profile data are removed before theme extraction.");
  await context.emit("patient_voice", "running", "Clustering themes", "Signals are clustered into practical concerns, not medical conclusions.");
  await context.emit("patient_voice", "completed", "Generating patient-experience questions", `${result.themes.length} themes are ready for coordinator questions.`);
  return { themes: result.themes, sourceMode: result.sourceMode };
}
