import { buildArtifacts } from "@/lib/synthesis/buildArtifacts";
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
  await context.emit("synthesis", "completed", "Final synthesis complete", `${artifacts.length} generated artifacts are ready.`);
  return artifacts;
}
