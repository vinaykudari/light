import { cleanForOutput, makeAgentOutput, makeFinding, normalizeCaseInput, uniqueTexts } from "./builders";
import { getAgentPrompt } from "./prompts";
import type { AgentOutput, LightCaseInput } from "./schemas";

function burdenSignals(input: LightCaseInput): string[] {
  const data = normalizeCaseInput(input);
  const trial = data.trial;
  const signals = [
    trial?.visits ? `Visit cadence: ${cleanForOutput(trial.visits)}` : "",
    (trial?.locations.length ?? 0) > 0
      ? `${trial?.locations.length ?? 0} site location item(s) to compare`
      : "",
    ...data.burdenPreferences.map(cleanForOutput),
  ];

  return uniqueTexts(signals.filter(Boolean)).slice(0, 6);
}

export function runBurdenAgent(input: LightCaseInput): AgentOutput {
  const data = normalizeCaseInput(input);
  const agent = "burden";
  const signals = burdenSignals(data);
  const patientVoiceTags = data.patientVoice.flatMap((item) => item.tags).slice(0, 4);

  return makeAgentOutput({
    agent,
    prompt: getAgentPrompt(agent),
    summary: `Burden scan for ${data.condition ?? "the selected trial context"}.`,
    findings: [
      makeFinding(
        agent,
        1,
        "Operational burden signals",
        signals.length ? "supported" : "missing",
        signals.length ? signals.join("; ") : "No visit, site, or preference signals were supplied.",
      ),
      makeFinding(
        agent,
        2,
        "Patient-stated constraints",
        patientVoiceTags.length ? "supported" : "uncertain",
        patientVoiceTags.length
          ? uniqueTexts(patientVoiceTags.map(cleanForOutput)).join("; ")
          : "No deidentified patient-stated constraints were tagged.",
      ),
      makeFinding(
        agent,
        3,
        "Coordinator follow-up",
        "uncertain",
        "Confirm travel, visit windows, remote options, reimbursement, caregiver needs, and testing schedule.",
      ),
    ],
    caveats: ["Burden estimates are planning support and require site-specific confirmation."],
  });
}
