import { queryNiaCorpus, type NiaIndexedSource } from "@/lib/adapters/niaIndexAdapter";
import { generateText } from "@/lib/adapters/llmAdapter";
import { collectRunSources, ensureRunIndexedOnNia, getRunNiaIndex } from "@/lib/runs/niaRunIndex";
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
  scope: ChatScope;
}> {
  const indexedSources = await ensureRunIndexedOnNia(input.run);
  const scope = detectScope(input.question, input.run, indexedSources);
  const context = buildRunContext(input.run, indexedSources, scope);
  const nia = await queryNiaCorpus({
    question: input.question,
    history: input.history,
    indexedSources: scope.sources,
    context,
  });
  const final = await generateText(buildPrompt(input.question, context, nia.content, scope.sources));
  return {
    answer: final.text,
    indexedSources: scope.sources,
    niaAnswer: nia.content,
    sourceMode: final.sourceMode === "real" && nia.sourceMode === "real" ? "real" : "mixed",
    scope,
  };
}

export async function indexClinicalResearchRun(run: TrialIntelligenceState): Promise<{
  indexedSources: NiaIndexedSource[];
  totalSources: number;
}> {
  const indexedSources = await ensureRunIndexedOnNia(run);
  return { indexedSources, totalSources: collectRunSources(run).length };
}

export function getClinicalResearchRunIndex(run: TrialIntelligenceState): {
  indexedSources: NiaIndexedSource[];
  totalSources: number;
} {
  return {
    indexedSources: getRunNiaIndex(run.runId),
    totalSources: collectRunSources(run).length,
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

type ChatScope = {
  kind: "trial" | "paper" | "voice" | "all";
  trialId?: string;
  sources: NiaIndexedSource[];
};

function detectScope(question: string, run: TrialIntelligenceState, sources: NiaIndexedSource[]): ChatScope {
  const nct = question.match(/\bNCT\d{8}\b/i)?.[0]?.toUpperCase();
  if (nct) {
    const scoped = sources.filter((source) => source.url.includes(nct) || source.title.toUpperCase().includes(nct));
    if (scoped.length) return { kind: "trial", trialId: nct, sources: scoped };
  }
  if (/\b(this|the|selected)\s+trial\b/i.test(question) && run.trials[0]) {
    const trialId = run.trials[0].nctId;
    const scoped = sources.filter((source) => source.url.includes(trialId) || source.title.includes(trialId));
    if (scoped.length) return { kind: "trial", trialId, sources: scoped };
  }
  if (/\bpaper|study|research|publication|pdf\b/i.test(question)) {
    const scoped = sources.filter((source) => source.kind === "paper" || source.kind === "web");
    if (scoped.length) return { kind: "paper", sources: scoped };
  }
  if (/\bx\.com|twitter|sentiment|patient voice|public post|social\b/i.test(question)) {
    const scoped = sources.filter((source) => source.kind === "x" || source.kind === "web");
    if (scoped.length) return { kind: "voice", sources: scoped };
  }
  if (/\bexpert|clinician|doctor|researcher|commentary|opinion\b/i.test(question)) {
    const scoped = sources.filter((source) => /expert context/i.test(source.title) || source.kind === "web" || source.kind === "x");
    if (scoped.length) return { kind: "voice", sources: scoped };
  }
  return { kind: "all", sources };
}

function buildRunContext(run: TrialIntelligenceState, sources: NiaIndexedSource[], scope: ChatScope): string {
  const trialCards = run.trials.map((trial) => ({
    nctId: trial.nctId,
    title: trial.title,
    status: trial.status,
    phase: trial.phase,
    sourceUrl: trial.sourceUrl,
    locations: trial.locations,
    matchedCriteria: trial.matchedCriteria,
    missingCriteria: trial.missingCriteria,
    exclusionRisks: trial.exclusionRisks,
    coordinatorQuestions: trial.coordinatorQuestions,
  }));
  return [
    `Chat scope: ${scope.kind}${scope.trialId ? ` ${scope.trialId}` : ""}`,
    `Condition context: ${run.patient.possibleConditionContext ?? run.patient.diagnosis}`,
    `Symptoms: ${(run.patient.symptoms ?? []).join(", ")}`,
    `Trials: ${run.trials.map((trial) => `${trial.nctId} ${trial.title}`).join("; ")}`,
    `Clinical trial cards JSON: ${JSON.stringify(trialCards)}`,
    `Research themes: ${run.research?.themes.join("; ") ?? "none yet"}`,
    `Patient voice themes: ${run.patientVoice.map((theme) => `${theme.theme}: ${theme.summary}`).join("; ")}`,
    `Expert context sources: ${(run.expertSources ?? []).map((source) => `${source.title}: ${source.url ?? "no url"}`).join("; ") || "none yet"}`,
    `Eligibility gaps: ${run.eligibility.flatMap((row) => row.missingData).join("; ")}`,
    `Indexed corpus: ${sources.filter((source) => source.status === "indexed").length}/${sources.length} Nia sources`,
  ].join("\n");
}
