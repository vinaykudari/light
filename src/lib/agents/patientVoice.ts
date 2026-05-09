import { cleanForOutput, makeAgentOutput, makeFinding, normalizeCaseInput, uniqueTexts } from "./builders";
import { getAgentPrompt } from "./prompts";
import type { AgentOutput, LightCaseInput } from "./schemas";

const THEME_RULES: Array<[string, RegExp]> = [
  ["Travel and distance", /\b(travel|drive|flight|hotel|distance|parking)\b/i],
  ["Visit schedule", /\b(visit|appointment|weekly|monthly|schedule|time off)\b/i],
  ["Testing burden", /\b(scan|biopsy|blood draw|lab|test|imaging)\b/i],
  ["Symptoms and fatigue", /\b(fatigue|pain|nausea|symptom|tired)\b/i],
  ["Cost and coverage", /\b(cost|insurance|copay|coverage|billing)\b/i],
  ["Caregiver coordination", /\b(caregiver|childcare|family|ride|support)\b/i],
];

function detectThemes(texts: string[], tags: string[]): string[] {
  const textThemes = texts.flatMap((text) =>
    THEME_RULES.filter(([, pattern]) => pattern.test(text)).map(([theme]) => theme),
  );
  const tagThemes = tags.map(cleanForOutput).filter(Boolean);

  return uniqueTexts([...textThemes, ...tagThemes]).slice(0, 6);
}

export function runPatientVoiceAgent(input: LightCaseInput): AgentOutput {
  const data = normalizeCaseInput(input);
  const agent = "patientVoice";
  const texts = data.patientVoice.map((item) => item.text);
  const tags = data.patientVoice.flatMap((item) => item.tags);
  const themes = detectThemes(texts, tags);

  return makeAgentOutput({
    agent,
    prompt: getAgentPrompt(agent),
    summary: `Deidentified patient voice scan using ${data.patientVoice.length} source item(s).`,
    findings: [
      makeFinding(
        agent,
        1,
        "Patient voice themes",
        themes.length ? "supported" : "missing",
        themes.length ? themes.join("; ") : "No patient voice themes were supplied.",
        data.patientVoice.map((item) => item.id),
      ),
      makeFinding(
        agent,
        2,
        "Privacy posture",
        "supported",
        "Raw posts, handles, profile links, and unique patient details are excluded from generated output.",
      ),
    ],
    caveats: ["Themes are directional and should be validated with deidentified source review."],
  });
}
