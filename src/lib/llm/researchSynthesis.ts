import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { PatientProfile, ResearchPaper, ResearchSummary } from "@/lib/types";

type ResearchSynthesis = {
  themes: string[];
  clinicianQuestions: string[];
  limitations: string[];
};

export async function synthesizeResearchWithLlm(
  patient: PatientProfile,
  query: string,
  papers: ResearchPaper[],
  sourceMode: ResearchSummary["sourceMode"],
): Promise<ResearchSummary> {
  const fallback = emptySynthesis(papers);
  const prompt = [
    "Synthesize retrieved research papers for clinical-trial discussion prep.",
    "Return only JSON: {\"themes\":[],\"clinicianQuestions\":[],\"limitations\":[]}.",
    "Use the supplied papers and patient profile. Connect symptoms to research categories only when supported. Do not provide treatment advice.",
    `Patient: ${JSON.stringify(patient)}`,
    `Papers: ${JSON.stringify(papers.slice(0, 8))}`,
  ].join("\n");
  const result = await generateStructured<ResearchSynthesis>(prompt, fallback);
  const synthesis = normalize(result.value, fallback);
  return {
    query,
    papersFound: papers.length,
    selectedPapers: papers,
    themes: synthesis.themes,
    clinicianQuestions: synthesis.clinicianQuestions,
    limitations: synthesis.limitations,
    sourceMode: sourceMode === "real" && result.sourceMode === "mock" ? "mixed" : sourceMode,
  };
}

function emptySynthesis(papers: ResearchPaper[]): ResearchSynthesis {
  return {
    themes: papers.length ? ["Retrieved papers need clinician review for relevance to the reported symptom cluster."] : [],
    clinicianQuestions: ["Which trial endpoints and screening criteria match the patient's reported symptoms?"],
    limitations: ["Research retrieval is educational context only and is not a diagnosis, treatment recommendation, or eligibility determination."],
  };
}

function normalize(value: ResearchSynthesis, fallback: ResearchSynthesis): ResearchSynthesis {
  return {
    themes: list(value.themes, fallback.themes),
    clinicianQuestions: list(value.clinicianQuestions, fallback.clinicianQuestions),
    limitations: list(value.limitations, fallback.limitations),
  };
}

function list(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8) : fallback;
}
