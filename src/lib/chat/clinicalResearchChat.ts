import { queryNiaCorpus, type NiaIndexedSource } from "@/lib/adapters/niaIndexAdapter";
import { generateText } from "@/lib/adapters/llmAdapter";
import { ensureRunIndexedOnNia } from "@/lib/runs/niaRunIndex";
import type { TrialIntelligenceState } from "@/lib/types";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function answerClinicalResearchChat(input: {
  run: TrialIntelligenceState;
  question: string;
  history?: ChatMessage[];
}): Promise<{
  answer: string;
  indexedSources: NiaIndexedSource[];
  niaAnswer: string;
  sourceMode: "real" | "mixed" | "mock";
}> {
  const indexedSources = await ensureRunIndexedOnNia(input.run);
  const context = buildRunContext(input.run, indexedSources);
  const nia = await queryNiaCorpus({
    question: input.question,
    history: input.history,
    indexedSources,
    context,
  });
  const final = await generateText(buildPrompt(input.question, context, nia.content, indexedSources));
  return {
    answer: final.text,
    indexedSources,
    niaAnswer: nia.content,
    sourceMode: final.sourceMode === "real" && nia.sourceMode === "real" ? "real" : "mixed",
  };
}

function buildPrompt(question: string, context: string, niaAnswer: string, sources: NiaIndexedSource[]): string {
  return [
    "Answer as Light's clinical research chatbot.",
    "Use only the Light run context and Nia retrieved corpus below.",
    "Give concise, practical, clinician-reviewable answers with source links.",
    "Do not diagnose, recommend treatment, determine eligibility, or quote social posts as verified medical evidence.",
    `Question: ${question}`,
    `Light run context:\n${context}`,
    `Nia retrieved answer:\n${niaAnswer}`,
    `Indexed sources:\n${sources.map((source) => `- ${source.title}: ${source.url} (${source.status})`).join("\n")}`,
  ].join("\n\n");
}

function buildRunContext(run: TrialIntelligenceState, sources: NiaIndexedSource[]): string {
  return [
    `Condition context: ${run.patient.possibleConditionContext ?? run.patient.diagnosis}`,
    `Symptoms: ${(run.patient.symptoms ?? []).join(", ")}`,
    `Trials: ${run.trials.map((trial) => `${trial.nctId} ${trial.title}`).join("; ")}`,
    `Research themes: ${run.research?.themes.join("; ") ?? "none yet"}`,
    `Patient voice themes: ${run.patientVoice.map((theme) => `${theme.theme}: ${theme.summary}`).join("; ")}`,
    `Eligibility gaps: ${run.eligibility.flatMap((row) => row.missingData).join("; ")}`,
    `Indexed corpus: ${sources.filter((source) => source.status === "indexed").length}/${sources.length} Nia sources`,
  ].join("\n");
}
