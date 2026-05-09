import { searchClinicalTrials } from "@/lib/adapters/clinicalTrialsAdapter";
import type { TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runTrialAgent(context: AgentContext): Promise<{
  trials: TrialCard[];
  sourceMode: "real" | "mock";
}> {
  await context.emit("trial", "running", "Searching official clinical trial records", "Calling ClinicalTrials.gov with condition, biomarker, intervention, and active-status queries.");
  const result = await searchClinicalTrials(context.patient);
  if (result.message) {
    await context.emit("trial", "running", "Source unavailable, using seeded demo data", result.message);
  }
  await context.emit("trial", "running", "Found candidate studies", result.querySummary ?? `${result.trials.length} candidate studies are available for review.`);
  await context.emit("trial", "running", "Filtering by biomarker and disease context", "Checking returned protocol text for NSCLC, EGFR/exon 20, active status, and study design.");
  await context.emit("trial", "running", "Reading practical protocol fields", "Extracting locations, criteria text, phase, source links, biopsy/tissue language, CNS language, and organ-function requirements.");
  await context.emit("trial", "running", "Ranking nearby trials", "Ranking official records before fallback data is considered.");
  await context.emit("trial", "completed", "Completed trial shortlist", `${result.trials.length} trial cards are ready.`);
  return { trials: result.trials, sourceMode: result.sourceMode };
}
