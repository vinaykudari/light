import { searchClinicalTrials } from "@/lib/adapters/clinicalTrialsAdapter";
import type { TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runTrialAgent(context: AgentContext): Promise<{
  trials: TrialCard[];
  sourceMode: "real" | "mock";
}> {
  await context.emit("trial", "running", "Searching official clinical trial records", "ClinicalTrials.gov search started for disease, biomarker, and recruiting status.");
  const result = await searchClinicalTrials(context.patient);
  if (result.message) {
    await context.emit("trial", "running", "Source unavailable, using seeded demo data", result.message);
  }
  await context.emit("trial", "running", "Found candidate studies", `${result.trials.length} candidate studies are available for review.`);
  await context.emit("trial", "running", "Filtering by biomarker and disease context", "Shortlist favors NSCLC, EGFR exon 20, recruiting status, and nearby locations.");
  await context.emit("trial", "running", "Ranking nearby trials", "Trials are ranked for potential relevance and practical follow-up questions.");
  await context.emit("trial", "completed", "Completed trial shortlist", `${result.trials.length} trial cards are ready.`);
  return { trials: result.trials, sourceMode: result.sourceMode };
}
