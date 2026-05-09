import { criteriaTopics, makeAgentOutput, makeFinding, normalizeCaseInput, uniqueTexts } from "./builders";
import { getAgentPrompt } from "./prompts";
import type { AgentOutput, LightCaseInput } from "./schemas";

const DEFAULT_UNKNOWN_TOPICS = [
  "diagnosis documentation",
  "stage or measurable disease",
  "prior therapy timeline",
  "performance status",
  "recent laboratory values",
];

export function runEligibilityAgent(input: LightCaseInput): AgentOutput {
  const data = normalizeCaseInput(input);
  const agent = "eligibility";
  const inclusionTopics = criteriaTopics(data.trial?.inclusionCriteria ?? []);
  const exclusionTopics = criteriaTopics(data.trial?.exclusionCriteria ?? []);
  const factLabels = uniqueTexts(data.facts.map((fact) => fact.label)).slice(0, 6);
  const unknownTopics = uniqueTexts([
    ...inclusionTopics,
    ...exclusionTopics,
    ...DEFAULT_UNKNOWN_TOPICS,
  ]).slice(0, 6);

  return makeAgentOutput({
    agent,
    prompt: getAgentPrompt(agent),
    summary: "Pre-screen evidence map for coordinator review; no enrollment decision is made.",
    findings: [
      makeFinding(
        agent,
        1,
        "Facts available",
        factLabels.length ? "supported" : "missing",
        factLabels.length ? factLabels.join("; ") : "No patient facts were supplied.",
      ),
      makeFinding(
        agent,
        2,
        "Inclusion topics to verify",
        inclusionTopics.length ? "uncertain" : "missing",
        inclusionTopics.length ? inclusionTopics.join("; ") : "No inclusion topic map is available.",
      ),
      makeFinding(
        agent,
        3,
        "Exclusion topics to rule out",
        exclusionTopics.length ? "uncertain" : "missing",
        exclusionTopics.length ? exclusionTopics.join("; ") : "No exclusion topic map is available.",
      ),
      makeFinding(
        agent,
        4,
        "Coordinator questions",
        "uncertain",
        unknownTopics.join("; "),
      ),
    ],
    caveats: ["Only a study team can complete source-document screening and enrollment review."],
  });
}
