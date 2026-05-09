import { buildEligibilityMatrix } from "@/lib/synthesis/buildEligibilityMatrix";
import type { EligibilityRow, TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runEligibilityAgent(
  context: AgentContext,
  trials: TrialCard[],
): Promise<EligibilityRow[]> {
  await context.emit("eligibility", "running", "Parsing trial criteria", "Agent is extracting matched criteria, missing data, and possible exclusion risks.");
  await context.emit("eligibility", "running", "Comparing patient profile to criteria", "Only potential relevance is assessed; final eligibility is not determined.");
  const rows = buildEligibilityMatrix(context.patient, trials);
  await context.emit("eligibility", "running", "Identifying missing data", "Missing fields are converted into clinician and coordinator checklist items.");
  await context.emit("eligibility", "completed", "Completed eligibility matrix", `${rows.length} trial review rows are ready.`);
  return rows;
}
