import type {
  AgentFinding,
  TrialIntelligenceInput,
  TrialIntelligenceResult,
  WorkflowEvent,
} from "./types";

interface SynthesisInput {
  workflowId: string;
  input: TrialIntelligenceInput;
  findings: AgentFinding[];
  events: WorkflowEvent[];
  executor: TrialIntelligenceResult["executor"];
  durationMs: number;
}

export function synthesizeTrialIntelligence({
  workflowId,
  input,
  findings,
  events,
  executor,
  durationMs,
}: SynthesisInput): TrialIntelligenceResult {
  const risks = unique(findings.flatMap((finding) => finding.risks)).slice(0, 8);
  const recommendations = unique(
    findings.flatMap((finding) => finding.actions),
  ).slice(0, 8);
  const topSignals = unique(findings.flatMap((finding) => finding.signals)).slice(
    0,
    4,
  );

  return {
    workflowId,
    status: findings.length > 0 ? "completed" : "failed",
    summary: buildSummary(input, findings, topSignals),
    findings,
    recommendations,
    risks,
    events,
    executor,
    durationMs,
  };
}

function buildSummary(
  input: TrialIntelligenceInput,
  findings: AgentFinding[],
  topSignals: string[],
): string {
  const subject = input.trialTitle ?? input.trialId ?? input.condition ?? "Trial";
  const confidence = findings.length
    ? Math.round(
        (findings.reduce((sum, finding) => sum + finding.confidence, 0) /
          findings.length) *
          100,
      )
    : 0;

  const signalText = topSignals.length
    ? ` Key signals: ${topSignals.join(" ")}`
    : "";

  return `${subject} intelligence completed across ${findings.length} specialist agents with ${confidence}% average confidence.${signalText}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
