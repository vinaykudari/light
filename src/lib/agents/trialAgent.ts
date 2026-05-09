import { searchClinicalTrials } from "@/lib/adapters/clinicalTrialsAdapter";
import type { SourceMode, TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runTrialAgent(context: AgentContext): Promise<{
  trials: TrialCard[];
  sourceMode: SourceMode;
}> {
  await context.emit("trial", "running", "Searching official clinical trial records", "Calling ClinicalTrials.gov with condition, symptom, intervention, and active-status queries.");
  const result = await searchClinicalTrials(context.patient);
  if (result.message) {
    await context.emit("trial", "running", "Official source status", result.message);
  }
  const topTrial = result.trials[0];
  if (topTrial) {
    await context.emit("trial", "running", "Trial Agent found official trial context", `${topTrial.nctId}: ${topTrial.title} was returned from official ClinicalTrials.gov records as potentially relevant for clinician/study-team review.`);
  }
  await context.emit("trial", "running", "Found candidate studies", result.querySummary ?? `${result.trials.length} candidate studies are available for review.`);
  await context.emit("trial", "running", "Filtering by symptom and disease context", "Checking returned protocol text for the extracted condition, symptoms, active status, and study design.");
  await context.emit("trial", "running", "Reading practical protocol fields", "Extracting locations, criteria text, phase, source links, visit burden, procedure language, and screening requirements.");
  await context.emit("trial", "running", "Ranking nearby trials", "Ranking official records by potential relevance, location, and practical follow-up questions.");
  await context.emit("trial", "completed", "Completed trial shortlist", `${result.trials.length} trial cards are ready.`);
  return { trials: result.trials, sourceMode: result.sourceMode };
}
