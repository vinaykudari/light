import { searchNiaContext } from "@/lib/adapters/niaAdapter";
import { searchPubMed } from "@/lib/adapters/pubmedAdapter";
import type { ResearchSummary, TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runResearchAgent(
  context: AgentContext,
  trials: TrialCard[],
): Promise<ResearchSummary> {
  await context.emit("research", "running", "Searching research papers", "Research agent is checking Nia capability and public PubMed records.");
  const nia = await searchNiaContext(context.patient, trials);
  if (nia.message) await context.emit("research", "running", "Sponsor integration unavailable, adapter preserved", nia.message);
  const summary = await searchPubMed(context.patient, trials);
  if (summary.sourceMode === "mock") {
    await context.emit("research", "running", "API failed, using fallback", "Research evidence is using seeded demo summaries.");
  }
  await context.emit("research", "running", "Retrieved papers", `${summary.papersFound} PubMed papers or seeded summaries are available.`);
  await context.emit("research", "running", "Selecting relevant studies", `Selected papers include: ${summary.selectedPapers.slice(0, 3).map((paper) => paper.title).join("; ")}`);
  await context.emit("research", "running", "Summarizing research context", "Research context is being converted into clinician-review questions.");
  await context.emit("research", "completed", "Completed research evidence summary", "Research evidence summary is ready.");
  return summary;
}
