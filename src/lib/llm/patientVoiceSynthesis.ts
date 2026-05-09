import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { PatientProfile, PatientVoicePost, PatientVoiceTheme } from "@/lib/types";

type VoiceSynthesis = {
  themes: PatientVoiceTheme[];
};

export async function synthesizeVoiceThemesWithLlm(
  patient: PatientProfile,
  posts: PatientVoicePost[],
): Promise<{ themes: PatientVoiceTheme[]; sourceMode: "real" | "mixed" }> {
  if (!posts.length) return synthesizeWithoutPosts(patient);
  const fallback = { themes: [genericTheme(posts.length)] };
  const prompt = [
    "Cluster sanitized public posts into patient-experience themes for clinical-trial discussion prep.",
    "Return only JSON: {\"themes\":[{\"theme\":\"\",\"sentiment\":\"positive|neutral|negative|mixed\",\"signalStrength\":\"low|medium|high\",\"summary\":\"\",\"coordinatorQuestion\":\"\",\"sourceCount\":1}]}",
    "Do not include usernames, direct quotes, medical claims, treatment advice, or eligibility conclusions. Label signals as unverified public patient-experience signals.",
    `Patient: ${JSON.stringify(patient)}`,
    `Sanitized posts/snippets: ${JSON.stringify(posts.slice(0, 12))}`,
  ].join("\n");
  const result = await generateStructured<VoiceSynthesis>(prompt, fallback);
  return {
    themes: normalizeThemes(result.value.themes, fallback.themes),
    sourceMode: result.sourceMode === "real" ? "real" : "mixed",
  };
}

export async function synthesizeVoiceFromSearchContext(
  patient: PatientProfile,
  context: string,
  sourceLabel: string,
): Promise<{ themes: PatientVoiceTheme[]; sourceMode: "real" | "mixed" }> {
  const fallback = { themes: [genericTheme(1)] };
  const prompt = [
    "Extract aggregate public patient-experience themes from search/context snippets for clinical-trial discussion prep.",
    "Return only JSON: {\"themes\":[{\"theme\":\"\",\"sentiment\":\"positive|neutral|negative|mixed\",\"signalStrength\":\"low|medium|high\",\"summary\":\"\",\"coordinatorQuestion\":\"\",\"sourceCount\":1}]}",
    "Use only aggregate themes. Do not include usernames, direct quotes, medical claims, treatment advice, or eligibility conclusions. Label signals as unverified public patient-experience signals.",
    `Source: ${sourceLabel}`,
    `Patient: ${JSON.stringify(patient)}`,
    `Context: ${context.slice(0, 6000)}`,
  ].join("\n");
  const result = await generateStructured<VoiceSynthesis>(prompt, fallback);
  return {
    themes: normalizeThemes(result.value.themes, fallback.themes),
    sourceMode: result.sourceMode === "real" ? "real" : "mixed",
  };
}

async function synthesizeWithoutPosts(patient: PatientProfile): Promise<{ themes: PatientVoiceTheme[]; sourceMode: "real" | "mixed" }> {
  const prompt = [
    "List public-patient-signal search themes to look for from X/web sources for this trial-prep profile.",
    "Return only JSON: {\"themes\":[{\"theme\":\"\",\"sentiment\":\"mixed\",\"signalStrength\":\"low\",\"summary\":\"Unverified public patient-experience signals to verify via live search: ...\",\"coordinatorQuestion\":\"\",\"sourceCount\":0}]}",
    "Do not invent actual posts or claim retrieval occurred.",
    `Patient: ${JSON.stringify(patient)}`,
  ].join("\n");
  const result = await generateStructured<VoiceSynthesis>(prompt, { themes: [] });
  return {
    themes: normalizeThemes(result.value.themes, []),
    sourceMode: result.sourceMode === "real" ? "real" : "mixed",
  };
}

function normalizeThemes(value: unknown, fallback: PatientVoiceTheme[]): PatientVoiceTheme[] {
  if (!Array.isArray(value)) return fallback;
  const themes = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const theme = text(record.theme);
    const summary = text(record.summary);
    const coordinatorQuestion = text(record.coordinatorQuestion);
    if (!theme || !summary || !coordinatorQuestion) return [];
    return [{
      theme,
      sentiment: sentiment(record.sentiment),
      signalStrength: strength(record.signalStrength),
      summary: summary.includes("Unverified") ? summary : `Unverified public patient-experience signals: ${summary}`,
      coordinatorQuestion,
      sourceCount: number(record.sourceCount),
    }];
  });
  return themes.length ? themes.slice(0, 6) : fallback;
}

function genericTheme(count: number): PatientVoiceTheme {
  return {
    theme: "Public patient-experience signal",
    sentiment: "mixed",
    signalStrength: count > 4 ? "medium" : "low",
    summary: "Unverified public patient-experience snippets mention symptoms, study participation, measurement, or practical burden.",
    coordinatorQuestion: "Which patient-reported outcomes and visit-burden supports matter for people describing this symptom cluster?",
    sourceCount: count,
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().replace(/@\w+/g, "") : undefined;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function sentiment(value: unknown): PatientVoiceTheme["sentiment"] {
  return value === "positive" || value === "neutral" || value === "negative" || value === "mixed" ? value : "mixed";
}

function strength(value: unknown): PatientVoiceTheme["signalStrength"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}
