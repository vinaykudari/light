import { criteriaTopics, makeAgentOutput, makeFinding, normalizeCaseInput } from "./builders";
import { getAgentPrompt } from "./prompts";
import type { AgentOutput, LightCaseInput } from "./schemas";

export function runTrialAgent(input: LightCaseInput): AgentOutput {
  const data = normalizeCaseInput(input);
  const trial = data.trial;
  const agent = "trial";
  const inclusionTopics = criteriaTopics(trial?.inclusionCriteria ?? []);
  const exclusionTopics = criteriaTopics(trial?.exclusionCriteria ?? []);
  const title = trial?.title ?? trial?.nctId ?? data.condition ?? "selected protocol";
  const phase = trial?.phase ? ` Phase: ${trial.phase}.` : "";
  const intervention = trial?.intervention
    ? ` Intervention field captured for research context: ${trial.intervention}.`
    : "";

  return makeAgentOutput({
    agent,
    prompt: getAgentPrompt(agent),
    summary: `Protocol abstraction for ${title}.${phase}${intervention}`,
    findings: [
      makeFinding(
        agent,
        1,
        "Protocol identity",
        trial ? "supported" : "missing",
        trial
          ? `Condition context: ${trial.condition ?? data.condition ?? "not specified"}.`
          : "No structured trial record was supplied.",
      ),
      makeFinding(
        agent,
        2,
        "Inclusion topic map",
        inclusionTopics.length ? "supported" : "missing",
        inclusionTopics.length
          ? inclusionTopics.join("; ")
          : "No inclusion criteria topics were available.",
      ),
      makeFinding(
        agent,
        3,
        "Exclusion topic map",
        exclusionTopics.length ? "supported" : "missing",
        exclusionTopics.length
          ? exclusionTopics.join("; ")
          : "No exclusion criteria topics were available.",
      ),
      makeFinding(
        agent,
        4,
        "Site footprint",
        (trial?.locations.length ?? 0) > 0 ? "supported" : "uncertain",
        `${trial?.locations.length ?? 0} location item(s) provided.`,
      ),
    ],
    caveats: ["Verify the source protocol and current site status before outreach."],
  });
}
