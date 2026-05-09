import { getCapabilityReport } from "@/lib/env";
import type { PatientProfile, ResearchPaper, TrialCard } from "@/lib/types";

export async function searchNiaContext(
  _patient: PatientProfile,
  _trials: TrialCard[],
): Promise<{ papers: ResearchPaper[]; available: boolean; message?: string }> {
  const available = getCapabilityReport().nia;
  if (!available) {
    return {
      papers: [],
      available: false,
      message: "Nia unavailable, adapter preserved for paper and protocol retrieval",
    };
  }
  return {
    papers: [],
    available: true,
    message: "Nia capability present, no project-specific retrieval endpoint configured",
  };
}
