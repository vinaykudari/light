import { buildArtifacts } from "@/lib/synthesis/buildArtifacts";
import { generateText } from "@/lib/adapters/llmAdapter";
import type {
  BurdenAnalysis,
  EligibilityRow,
  GeneratedArtifact,
  PatientVoiceTheme,
  ResearchSummary,
  TrialCard,
} from "@/lib/types";
import type { AgentContext } from "./types";

export async function runSynthesisAgent(
  context: AgentContext,
  input: {
    trials: TrialCard[];
    research: ResearchSummary;
    patientVoice: PatientVoiceTheme[];
    eligibility: EligibilityRow[];
    burden: BurdenAnalysis;
  },
): Promise<GeneratedArtifact[]> {
  await context.emit("synthesis", "running", "Synthesizing final briefing", "Agent is building patient-friendly and clinician-review outputs.");
  await context.emit("synthesis", "running", "Generating patient questions", "Practical questions are based on protocol, evidence, and patient voice themes.");
  await context.emit("synthesis", "running", "Generating clinician checklist", "Missing data and source limitations are being organized for review.");
  await context.emit("synthesis", "running", "Generating coordinator draft", "Coordinator outreach is framed as pre-screening guidance only.");
  const artifacts = buildArtifacts(context.runId, context.patient, input);
  const llm = await generateText(buildPrompt(context.patient.diagnosis, input));
  if (llm.sourceMode === "real") {
    artifacts[0] = {
      ...artifacts[0],
      content: [
        llm.text,
        "",
        "Safety note: Light supports education and clinician-reviewed referral preparation only. Final eligibility must be confirmed by the study team.",
      ].join("\n"),
    };
    await context.emit("synthesis", "running", "LLM synthesis complete", "Generated the patient briefing from retrieved trial, research, patient voice, eligibility, and burden context.");
  } else {
    await context.emit("synthesis", "running", "LLM unavailable, using deterministic synthesis", "Generated artifacts from retrieved structured context without model output.");
  }
  await context.emit("synthesis", "completed", "Final synthesis complete", `${artifacts.length} generated artifacts are ready.`);
  return artifacts;
}

function buildPrompt(diagnosis: string, input: {
  trials: TrialCard[];
  research: ResearchSummary;
  patientVoice: PatientVoiceTheme[];
  eligibility: EligibilityRow[];
  burden: BurdenAnalysis;
}): string {
  return [
    "Write a concise patient-friendly clinical trial referral-prep briefing.",
    "Do not provide medical advice, treatment recommendations, or final eligibility claims.",
    `Diagnosis: ${diagnosis}`,
    `Trials: ${input.trials.map((trial) => `${trial.nctId} ${trial.title}`).join("; ")}`,
    `Research papers: ${input.research.selectedPapers.map((paper) => paper.title).join("; ")}`,
    `Patient voice themes: ${input.patientVoice.map((theme) => theme.theme).join("; ")}`,
    `Missing data: ${input.eligibility.flatMap((row) => row.missingData).join("; ")}`,
    `Logistics questions: ${input.burden.coordinatorQuestions.join("; ")}`,
    "End by saying clinician and study-team review is required.",
  ].join("\n");
}
