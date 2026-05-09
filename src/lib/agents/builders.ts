import { filterUnsafeContent, redactUnsafeText } from "@/lib/safety";
import {
  AgentOutputSchema,
  LightCaseInputSchema,
  type AgentFinding,
  type AgentName,
  type AgentOutput,
  type FindingStatus,
  type LightCaseInput,
  type NormalizedLightCaseInput,
} from "./schemas";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "for",
  "from",
  "have",
  "into",
  "that",
  "the",
  "their",
  "this",
  "with",
  "without",
]);

const CRITERIA_TOPICS: Array<[string, RegExp]> = [
  ["Diagnosis confirmation", /\b(diagnos|histolog|patholog|tumou?r|cancer)\b/i],
  ["Disease stage or measurable disease", /\b(stage|measurable|lesion|metasta)\b/i],
  ["Age range", /\b(age|years old|adult|pediatric)\b/i],
  ["Performance status", /\b(ecog|karnofsky|performance status)\b/i],
  ["Prior therapy history", /\b(prior|previous|treated|therapy|chemo|radiation)\b/i],
  ["Medication or comorbidity review", /\b(concomitant|comorbid|cardiac|renal|hepatic)\b/i],
  ["Laboratory threshold", /\b(lab|platelet|hemoglobin|neutrophil|creatinine|bilirubin)\b/i],
  ["Pregnancy or reproductive criteria", /\b(pregnan|contracep|reproductive)\b/i],
];

export function normalizeCaseInput(input: LightCaseInput): NormalizedLightCaseInput {
  return LightCaseInputSchema.parse(input);
}

export function cleanForOutput(value: string | undefined): string {
  return redactUnsafeText(value ?? "").replace(/\s+/g, " ").trim();
}

export function compact<T>(items: Array<T | false | null | undefined | "">): T[] {
  return items.filter(Boolean) as T[];
}

export function uniqueTexts(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function keywordsFrom(texts: string[], limit = 6): string[] {
  const words = texts
    .map(cleanForOutput)
    .join(" ")
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{3,}/g);

  if (!words) return [];

  return uniqueTexts(words.filter((word) => !STOP_WORDS.has(word))).slice(0, limit);
}

export function criteriaTopics(criteria: string[], limit = 5): string[] {
  const topics = criteria.flatMap((criterion) =>
    CRITERIA_TOPICS.filter(([, pattern]) => pattern.test(criterion)).map(
      ([topic]) => topic,
    ),
  );

  return uniqueTexts(topics).slice(0, limit);
}

export function makeFinding(
  agent: AgentName,
  index: number,
  label: string,
  status: FindingStatus,
  detail: string,
  evidenceIds: string[] = [],
): AgentFinding {
  return {
    id: `${agent}-${index}`,
    label: cleanForOutput(label),
    status,
    detail: cleanForOutput(detail),
    evidenceIds: uniqueTexts(evidenceIds),
  };
}

export function makeAgentOutput(params: {
  agent: AgentName;
  prompt: string;
  summary: string;
  findings: AgentFinding[];
  caveats?: string[];
}): AgentOutput {
  const content = [
    params.summary,
    ...params.findings.flatMap((finding) => [finding.label, finding.detail]),
    ...(params.caveats ?? []),
  ].join("\n");
  const safety = filterUnsafeContent(content);

  if (!safety.allowed) {
    return AgentOutputSchema.parse({
      agent: params.agent,
      mode: "mock_safe",
      generatedAt: "deterministic-mock",
      prompt: params.prompt,
      summary: "Safety review withheld generated text for coordinator review.",
      findings: [],
      caveats: ["Only deidentified research summaries and follow-up questions are allowed."],
      safety,
    });
  }

  return AgentOutputSchema.parse({
    agent: params.agent,
    mode: "mock_safe",
    generatedAt: "deterministic-mock",
    prompt: params.prompt,
    summary: cleanForOutput(params.summary),
    findings: params.findings.map((finding) => ({
      ...finding,
      label: cleanForOutput(finding.label),
      detail: cleanForOutput(finding.detail),
    })),
    caveats: (params.caveats ?? []).map(cleanForOutput).filter(Boolean),
    safety,
  });
}

export function sourceTitles(
  sources: Array<{ id: string; title?: string; text?: string }>,
): string[] {
  return sources.map((source) => cleanForOutput(source.title || source.id)).slice(0, 4);
}
