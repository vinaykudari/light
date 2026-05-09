import { applyMedicalSafety } from "@/lib/safety/medicalSafety";
import type { ResearchSummary } from "@/lib/types";

export function summarizeResearch(summary: ResearchSummary): string {
  const papers = summary.selectedPapers
    .slice(0, 3)
    .map((paper) => `- ${applyMedicalSafety(paper.title)}${paper.year ? ` (${paper.year})` : ""}: ${applyMedicalSafety(paper.relevanceReason)}`)
    .join("\n");
  return [
    `Research search: ${applyMedicalSafety(summary.query)}`,
    `Papers found: ${summary.papersFound}`,
    papers,
    "Limitations:",
    ...summary.limitations.map((item) => `- ${applyMedicalSafety(item)}`),
  ].filter(Boolean).join("\n");
}
