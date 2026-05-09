import {
  runBurdenAgent,
  runEligibilityAgent,
  runPatientVoiceAgent,
  runResearchAgent,
  runSafetyAgent,
  runTrialAgent,
} from "@/lib/agents";
import { SynthesisInputSchema, type SynthesisInput, type SynthesisOutput } from "./schemas";
import { buildSynthesisOutput } from "./builders";

export function runSynthesisAgent(input: SynthesisInput): SynthesisOutput {
  const data = SynthesisInputSchema.parse(input);
  const baseOutputs = data.agentOutputs.length
    ? data.agentOutputs
    : [
        runTrialAgent(data.caseInput),
        runResearchAgent(data.caseInput),
        runPatientVoiceAgent(data.caseInput),
        runEligibilityAgent(data.caseInput),
        runBurdenAgent(data.caseInput),
      ];
  const safetyOutput = runSafetyAgent({ outputs: baseOutputs });

  return buildSynthesisOutput({
    condition: data.caseInput.condition ?? data.caseInput.trial?.condition,
    outputs: [...baseOutputs, safetyOutput],
  });
}
