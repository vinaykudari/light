import { searchPatientVoice } from "@/lib/adapters/xAdapter";
import type { PatientVoiceTheme, SourceMode } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runPatientVoiceAgent(context: AgentContext): Promise<{
  themes: PatientVoiceTheme[];
  sourceMode: SourceMode;
}> {
  await context.emit("patient_voice", "running", "Searching public patient-experience signals", "Discovering X status links, then hydrating post text through the Claw localizer X API.");
  const result = await searchPatientVoice(context.patient);
  if (result.message) {
    await context.emit("patient_voice", "running", "Source handoff", result.message);
  }
  await context.emit("patient_voice", "running", "Retrieved public posts", `${result.posts.length} sanitized public signals are available.`);
  await context.emit("patient_voice", "running", "Filtering irrelevant posts", "Usernames, links, profile data, and direct quotes are removed before theme extraction.");
  await context.emit("patient_voice", "running", "Clustering themes", "Signals are clustered into practical concerns, not medical conclusions.");
  await context.emit("patient_voice", "completed", "Generating patient-experience questions", `${result.themes.length} themes are ready for coordinator questions.`);
  return { themes: result.themes, sourceMode: result.sourceMode };
}
