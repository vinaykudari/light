import type {
  AgentFinding,
  TrialAgent,
  TrialAgentContext,
  TrialIntelligenceInput,
} from "./types";

export const defaultTrialAgents: TrialAgent[] = [
  { id: "evidence", label: "Evidence agent", run: runEvidenceAgent },
  { id: "eligibility", label: "Eligibility agent", run: runEligibilityAgent },
  { id: "patient-voice", label: "Patient voice agent", run: runPatientVoiceAgent },
  { id: "operations", label: "Operations agent", run: runOperationsAgent },
];

export function trialInputText(input: TrialIntelligenceInput): string {
  const documentText = input.documents
    ?.map((document) => [document.title, document.text].filter(Boolean).join("\n"))
    .join("\n\n");

  return [
    input.trialTitle,
    input.condition,
    input.phase,
    input.sponsor,
    input.intervention,
    input.criteria,
    input.endpoints,
    Array.isArray(input.patientVoice)
      ? input.patientVoice.join("\n")
      : input.patientVoice,
    input.sites?.join(", "),
    documentText,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runEvidenceAgent({
  input,
}: TrialAgentContext): Promise<AgentFinding> {
  const text = trialInputText(input);
  const signals = compact([
    input.phase ? `Phase: ${input.phase}` : undefined,
    input.intervention ? `Intervention: ${input.intervention}` : undefined,
    input.endpoints ? `Endpoints: ${input.endpoints}` : undefined,
    keywordSignal(text, ["overall survival", "progression", "response"], "Efficacy endpoint language is present."),
  ]);

  return finding("evidence", "Evidence posture", {
    summary: signals.length
      ? "Evidence inputs are ready for endpoint and comparator review."
      : "Evidence inputs are thin; add protocol, endpoint, or publication context.",
    signals,
    risks: compact([
      input.endpoints ? undefined : "Primary and secondary endpoints are not specified.",
      keywordSignal(text, ["placebo", "standard of care"], "Comparator strategy needs explicit evidence framing."),
    ]),
    actions: compact([
      input.endpoints ? "Map each endpoint to source evidence and measurement cadence." : "Capture endpoint definitions before scoring the trial.",
      "Record the comparator and standard-of-care rationale.",
    ]),
    confidence: signals.length > 1 ? 0.72 : 0.45,
  });
}

async function runEligibilityAgent({
  input,
}: TrialAgentContext): Promise<AgentFinding> {
  const criteria = input.criteria ?? "";
  const hasInclusion = /inclusion|eligible|must have/i.test(criteria);
  const hasExclusion = /exclusion|not eligible|exclude/i.test(criteria);

  return finding("eligibility", "Eligibility fit", {
    summary: criteria
      ? "Eligibility criteria are available for patient matching and burden review."
      : "Eligibility criteria are missing, so match quality is low.",
    signals: compact([
      hasInclusion ? "Inclusion criteria detected." : undefined,
      hasExclusion ? "Exclusion criteria detected." : undefined,
      input.condition ? `Condition focus: ${input.condition}` : undefined,
    ]),
    risks: compact([
      criteria ? undefined : "No eligibility criteria supplied.",
      !hasExclusion && criteria ? "Exclusion criteria are not clearly separated." : undefined,
    ]),
    actions: [
      "Normalize inclusion and exclusion criteria into patient-match fields.",
      "Flag criteria that require labs, imaging, or travel-heavy confirmation.",
    ],
    confidence: criteria ? 0.68 : 0.35,
  });
}

async function runPatientVoiceAgent({
  input,
}: TrialAgentContext): Promise<AgentFinding> {
  const text = trialInputText(input);
  const burden = keywordSignal(text, ["travel", "visit", "transport", "time off"], "Patient burden language appears in the inputs.");
  const safety = keywordSignal(text, ["adverse", "toxicity", "side effect", "tolerability"], "Safety or tolerability concerns appear in the inputs.");

  return finding("patient-voice", "Patient voice", {
    summary: input.patientVoice
      ? "Patient voice inputs are available for burden, safety, and adherence analysis."
      : "No patient voice input was supplied; use community or interview data before prioritizing.",
    signals: compact([burden, safety]),
    risks: compact([
      input.patientVoice ? undefined : "Patient preference and burden evidence is missing.",
      burden ? "Visit burden may suppress enrollment or retention." : undefined,
    ]),
    actions: [
      "Summarize patient-language objections and motivations.",
      "Convert burden themes into protocol or site-experience mitigations.",
    ],
    confidence: input.patientVoice ? 0.7 : 0.38,
  });
}

async function runOperationsAgent({
  input,
}: TrialAgentContext): Promise<AgentFinding> {
  const siteCount = input.sites?.length ?? 0;

  return finding("operations", "Operational readiness", {
    summary: siteCount > 0
      ? "Site footprint is available for startup and enrollment planning."
      : "Site footprint is missing; operational feasibility is uncertain.",
    signals: compact([
      siteCount > 0 ? `${siteCount} site${siteCount === 1 ? "" : "s"} supplied.` : undefined,
      input.sponsor ? `Sponsor: ${input.sponsor}` : undefined,
    ]),
    risks: compact([
      siteCount === 0 ? "No sites supplied for enrollment feasibility." : undefined,
      siteCount > 0 && siteCount < 3 ? "Small site footprint may constrain enrollment." : undefined,
    ]),
    actions: [
      "Rank sites by reachable population, activation speed, and visit burden.",
      "Create an enrollment watchlist for criteria bottlenecks and drop-off points.",
    ],
    confidence: siteCount > 0 ? 0.64 : 0.4,
  });
}

function finding(
  agentId: string,
  title: string,
  value: Omit<AgentFinding, "agentId" | "title">,
): AgentFinding {
  return { agentId, title, ...value };
}

function keywordSignal(
  text: string,
  keywords: string[],
  signal: string,
): string | undefined {
  return keywords.some((keyword) => text.toLowerCase().includes(keyword))
    ? signal
    : undefined;
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}
