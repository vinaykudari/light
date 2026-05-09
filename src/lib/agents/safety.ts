import { filterUnsafeContent } from "@/lib/safety";
import { makeFinding } from "./builders";
import { getAgentPrompt } from "./prompts";
import { AgentOutputSchema, type AgentOutput } from "./schemas";

export type SafetyAgentInput = {
  text?: string;
  outputs?: AgentOutput[];
};

function serializeOutput(output: AgentOutput): string {
  return [
    output.summary,
    ...output.findings.flatMap((finding) => [finding.label, finding.detail]),
    ...output.caveats,
  ].join("\n");
}

export function runSafetyAgent(input: SafetyAgentInput): AgentOutput {
  const agent = "safety";
  const outputs = (input.outputs ?? []).map((output) => AgentOutputSchema.parse(output));
  const text = [input.text ?? "", ...outputs.map(serializeOutput)].join("\n");
  const review = filterUnsafeContent(text);
  const categories = review.categories.length ? review.categories.join(", ") : "none";

  return AgentOutputSchema.parse({
    agent,
    mode: "mock_safe",
    generatedAt: "deterministic-mock",
    prompt: getAgentPrompt(agent),
    summary: review.allowed
      ? "Safety gate passed after deterministic filtering."
      : "Safety gate blocked generated content before display.",
    findings: [
      makeFinding(
        agent,
        1,
        "Safety categories",
        review.allowed ? "supported" : "risk",
        `Detected categories: ${categories}.`,
      ),
      makeFinding(
        agent,
        2,
        "Display text",
        review.redacted ? "uncertain" : "supported",
        review.redacted
          ? "Identifier-like content was redacted before display."
          : "No redaction was needed.",
      ),
    ],
    caveats: ["Blocked content is not returned by the mock-safe agent layer."],
    safety: review,
  });
}
