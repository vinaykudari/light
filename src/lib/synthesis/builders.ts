import { filterUnsafeContent, redactUnsafeText } from "@/lib/safety";
import type { AgentOutput } from "@/lib/agents/schemas";
import { SynthesisOutputSchema, type SynthesisOutput, type SynthesisSection } from "./schemas";
import { SYNTHESIS_PROMPT } from "./prompts";

function clean(value: string): string {
  return redactUnsafeText(value).replace(/\s+/g, " ").trim();
}

function itemsFor(agent: AgentOutput | undefined): string[] {
  if (!agent) return [];

  return agent.findings.map((finding) => clean(`${finding.label}: ${finding.detail}`));
}

function findAgent(outputs: AgentOutput[], name: AgentOutput["agent"]): AgentOutput | undefined {
  return outputs.find((output) => output.agent === name);
}

function section(title: string, items: string[]): SynthesisSection {
  return {
    title,
    items: items.filter(Boolean).slice(0, 5),
  };
}

export function buildSynthesisOutput(params: {
  condition?: string;
  outputs: AgentOutput[];
}): SynthesisOutput {
  const trial = findAgent(params.outputs, "trial");
  const research = findAgent(params.outputs, "research");
  const voice = findAgent(params.outputs, "patientVoice");
  const screening = findAgent(params.outputs, "eligibility");
  const burden = findAgent(params.outputs, "burden");
  const sections = [
    section("Protocol and evidence", [
      trial?.summary ?? "",
      research?.summary ?? "",
      ...itemsFor(research).slice(0, 2),
    ]),
    section("Patient voice and burden", [
      voice?.summary ?? "",
      burden?.summary ?? "",
      ...itemsFor(voice).slice(0, 2),
      ...itemsFor(burden).slice(0, 2),
    ]),
    section("Pre-screen unknowns", itemsFor(screening)),
  ].filter((entry) => entry.items.length > 0);
  const nextQuestions = [
    "Which source documents confirm diagnosis, stage, prior therapy, performance status, and recent labs?",
    "Which site-specific visit windows, remote options, and reimbursement policies apply?",
    "Which deidentified patient voice themes should be validated with source review?",
  ];
  const summary = `Coordinator-ready synthesis for ${params.condition ?? "the selected trial context"} using ${params.outputs.length} mock-safe agent output(s).`;
  const caveats = [
    "This synthesis is research support only and requires study-team review.",
    "Generated text excludes raw patient identifiers and direct patient care instructions.",
  ];
  const content = [
    summary,
    ...sections.flatMap((entry) => [entry.title, ...entry.items]),
    ...nextQuestions,
    ...caveats,
  ].join("\n");
  const safety = filterUnsafeContent(content);

  if (!safety.allowed) {
    return SynthesisOutputSchema.parse({
      agent: "synthesis",
      mode: "mock_safe",
      generatedAt: "deterministic-mock",
      prompt: SYNTHESIS_PROMPT,
      summary: "Safety review withheld synthesis text for coordinator review.",
      sections: [],
      nextQuestions: [],
      caveats: ["Only deidentified research summaries and follow-up questions are allowed."],
      safety,
    });
  }

  return SynthesisOutputSchema.parse({
    agent: "synthesis",
    mode: "mock_safe",
    generatedAt: "deterministic-mock",
    prompt: SYNTHESIS_PROMPT,
    summary: clean(summary),
    sections,
    nextQuestions: nextQuestions.map(clean),
    caveats: caveats.map(clean),
    safety,
  });
}
