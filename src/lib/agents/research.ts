import {
  keywordsFrom,
  makeAgentOutput,
  makeFinding,
  normalizeCaseInput,
  sourceTitles,
} from "./builders";
import { getAgentPrompt } from "./prompts";
import type { AgentOutput, LightCaseInput } from "./schemas";

export function runResearchAgent(input: LightCaseInput): AgentOutput {
  const data = normalizeCaseInput(input);
  const agent = "research";
  const sourceCount = data.research.length;
  const titles = sourceTitles(data.research);
  const keywords = keywordsFrom(data.research.map((source) => source.text), 8);

  return makeAgentOutput({
    agent,
    prompt: getAgentPrompt(agent),
    summary: `Research scan for ${data.condition ?? "the requested condition"} using ${sourceCount} source item(s).`,
    findings: [
      makeFinding(
        agent,
        1,
        "Evidence inventory",
        sourceCount ? "supported" : "missing",
        sourceCount ? titles.join("; ") : "No research sources were supplied.",
        data.research.map((source) => source.id),
      ),
      makeFinding(
        agent,
        2,
        "Recurring concepts",
        keywords.length ? "supported" : "uncertain",
        keywords.length ? keywords.join(", ") : "No recurring research concepts were detected.",
      ),
      makeFinding(
        agent,
        3,
        "Evidence limits",
        "uncertain",
        "Mock evidence extraction does not assess study quality, effect size, or clinical action.",
      ),
    ],
    caveats: ["Use source abstracts or full text for any evidence-sensitive decision support."],
  });
}
