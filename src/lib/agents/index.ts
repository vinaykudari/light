export * from "./burden";
export * from "./builders";
export * from "./eligibility";
export * from "./patientVoice";
export * from "./prompts";
export * from "./research";
export * from "./safety";
export * from "./schemas";
export * from "./trial";

import { runBurdenAgent } from "./burden";
import { runEligibilityAgent } from "./eligibility";
import { runPatientVoiceAgent } from "./patientVoice";
import { runResearchAgent } from "./research";
import { runSafetyAgent } from "./safety";
import type { AgentOutput, LightCaseInput } from "./schemas";
import { runTrialAgent } from "./trial";

export function runLightAgents(input: LightCaseInput): AgentOutput[] {
  const outputs = [
    runTrialAgent(input),
    runResearchAgent(input),
    runPatientVoiceAgent(input),
    runEligibilityAgent(input),
    runBurdenAgent(input),
  ];

  return [...outputs, runSafetyAgent({ outputs })];
}
