import { searchNiaContext } from "@/lib/adapters/niaAdapter";
import { searchPubMed } from "@/lib/adapters/pubmedAdapter";
import type { ResearchSummary, TrialCard } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runResearchAgent(
  context: AgentContext,
  trials: TrialCard[],
): Promise<ResearchSummary> {
  await context.emit("research", "running", "Searching research papers", "Research agent is checking Nia capability and public PubMed records.");
  const [nia, pubMed] = await Promise.all([
    searchNiaContext(context.patient, trials),
    searchPubMed(context.patient, trials),
  ]);
  if (nia.message) {
    await context.emit("research", "running", nia.available ? "Nia context retrieval complete" : "Sponsor integration unavailable, adapter preserved", nia.message);
  }
  const summary = mergeResearch(pubMed, nia.papers);
  if (summary.sourceMode === "mock") {
    await context.emit("research", "running", "API failed, using fallback", "Research evidence is using seeded demo summaries.");
  }
  await context.emit("research", "running", "Retrieved papers", `${summary.papersFound} PubMed/Nia papers or seeded summaries are available.`);
  await context.emit("research", "running", "Selecting relevant studies", `Selected papers include: ${summary.selectedPapers.slice(0, 3).map((paper) => paper.title).join("; ")}`);
  await context.emit("research", "running", "Summarizing research context", "Research context is being converted into clinician-review questions.");
  await context.emit("research", "completed", "Completed research evidence summary", "Research evidence summary is ready.");
  return summary;
}

function mergeResearch(summary: ResearchSummary, niaPapers: ResearchSummary["selectedPapers"]): ResearchSummary {
  if (!niaPapers.length) return summary;
  const selectedPapers = dedupePapers([...niaPapers, ...summary.selectedPapers]).slice(0, 7);
  return {
    ...summary,
    papersFound: selectedPapers.length,
    selectedPapers,
    sourceMode: summary.sourceMode === "mock" ? "mixed" : "real",
    themes: [
      "Nia adds cross-source context from public web, protocol-adjacent, and research sources.",
      ...summary.themes,
    ],
  };
}

function dedupePapers(papers: ResearchSummary["selectedPapers"]): ResearchSummary["selectedPapers"] {
  const seen = new Set<string>();
  return papers.filter((paper) => {
    const key = `${paper.title}:${paper.url ?? ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
