import { runBurdenAgent } from "@/lib/agents/burdenAgent";
import { runEligibilityAgent } from "@/lib/agents/eligibilityAgent";
import { runPatientVoiceAgent } from "@/lib/agents/patientVoiceAgent";
import { runResearchAgent } from "@/lib/agents/researchAgent";
import { runSafetyAgent } from "@/lib/agents/safetyAgent";
import { runSynthesisAgent } from "@/lib/agents/synthesisAgent";
import { runTrialAgent } from "@/lib/agents/trialAgent";
import { runWithTensorlakeOrLocal } from "@/lib/adapters/tensorlakeAdapter";
import { capabilityMode, getCapabilityReport } from "@/lib/env";
import type {
  AgentEvent,
  AgentName,
  EventStatus,
  PatientProfile,
  SourceMode,
  TrialIntelligenceState,
} from "@/lib/types";
import { makeAgentEvent, makeRunId } from "./emitEvent";

export type RunUpdate = (state: TrialIntelligenceState) => void | Promise<void>;

export async function runTrialIntelligence(
  patient: PatientProfile,
  onUpdate?: RunUpdate,
  runIdOverride?: string,
): Promise<TrialIntelligenceState> {
  const runId = runIdOverride ?? makeRunId();
  const now = new Date().toISOString();
  const capabilities = getCapabilityReport();
  const state: TrialIntelligenceState = {
    runId,
    status: "running",
    sourceMode: capabilityMode(capabilities),
    patient,
    capabilities,
    events: [],
    trials: [],
    patientVoice: [],
    eligibility: [],
    artifacts: [],
    createdAt: now,
    updatedAt: now,
  };

  const update = async () => {
    state.updatedAt = new Date().toISOString();
    await onUpdate?.(cloneState(state));
  };
  const emit = async (
    agent: AgentName,
    status: EventStatus,
    title: string,
    detail: string,
    metadata?: AgentEvent["metadata"],
  ) => {
    state.events.push(makeAgentEvent({ runId, agent, status, title, detail, metadata }));
    await update();
  };

  await emit("system", "running", "Light started trial intelligence run", "Synthetic patient profile stored for education and referral preparation.");
  const result = await runWithTensorlakeOrLocal({
    runLocal: () => runLocalLightWorkflow(state, emit, update),
    payload: {
      kind: "light.trial_intelligence.run",
      runId,
      patient,
      source: "light.hackerpod.dev",
    },
  });
  if (result.message) {
    await emit("system", "running", "Workflow executor selected", result.message, { executor: result.executor });
  }
  return result.result;
}

async function runLocalLightWorkflow(
  state: TrialIntelligenceState,
  emit: Parameters<typeof runTrialAgent>[0]["emit"],
  update: () => Promise<void>,
): Promise<TrialIntelligenceState> {
  try {
    const trialPromise = runTrialAgent({ runId: state.runId, patient: state.patient, emit });
    const voicePromise = runPatientVoiceAgent({ runId: state.runId, patient: state.patient, emit });

    const trialResult = await trialPromise;
    state.trials = trialResult.trials;
    state.sourceMode = mergeModes(state.sourceMode, trialResult.sourceMode);
    await update();

    const [research, voiceResult] = await Promise.all([
      runResearchAgent({ runId: state.runId, patient: state.patient, emit }, state.trials),
      voicePromise,
    ]);
    state.research = research;
    state.patientVoice = voiceResult.themes;
    state.sourceMode = mergeModes(state.sourceMode, research.sourceMode, voiceResult.sourceMode);
    await update();

    const [eligibility, burden] = await Promise.all([
      runEligibilityAgent({ runId: state.runId, patient: state.patient, emit }, state.trials),
      runBurdenAgent({ runId: state.runId, patient: state.patient, emit }, state.trials, state.patientVoice),
    ]);
    state.eligibility = eligibility;
    state.burden = burden;
    await update();

    const artifacts = await runSynthesisAgent(
      { runId: state.runId, patient: state.patient, emit },
      {
        trials: state.trials,
        research,
        patientVoice: state.patientVoice,
        eligibility,
        burden,
      },
    );
    const safe = await runSafetyAgent({ runId: state.runId, patient: state.patient, emit }, artifacts, state.patientVoice);
    state.artifacts = safe.artifacts;
    state.patientVoice = safe.themes;
    state.status = "completed";
    await update();
    return cloneState(state);
  } catch (error) {
    state.status = "failed";
    state.error = error instanceof Error ? error.message : "Unknown workflow error";
    state.events.push(makeAgentEvent({
      runId: state.runId,
      agent: "system",
      status: "failed",
      title: "Run failed",
      detail: state.error,
    }));
    await update();
    return cloneState(state);
  }
}

function mergeModes(...modes: SourceMode[]): SourceMode {
  if (modes.every((mode) => mode === "real")) return "real";
  if (modes.every((mode) => mode === "mock")) return "mock";
  return "mixed";
}

function cloneState(state: TrialIntelligenceState): TrialIntelligenceState {
  return JSON.parse(JSON.stringify(state)) as TrialIntelligenceState;
}
