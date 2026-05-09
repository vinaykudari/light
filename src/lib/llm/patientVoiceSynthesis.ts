import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { PatientProfile, PatientVoicePost, PatientVoiceSource, PatientVoiceTheme } from "@/lib/types";

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
  const sources = posts.map(postSource).filter((item): item is PatientVoiceSource => Boolean(item));
  return {
    themes: attachSources(normalizeThemes(result.value.themes, fallback.themes), sources),
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
  const sources = extractSources(context);
  return {
    themes: attachSources(normalizeThemes(result.value.themes, fallback.themes), sources),
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

function attachSources(themes: PatientVoiceTheme[], sources: PatientVoiceSource[]): PatientVoiceTheme[] {
  if (!sources.length) return themes;
  return themes.map((theme, index) => ({
    ...theme,
    sources: pickSources(sources, index),
  }));
}

function pickSources(sources: PatientVoiceSource[], index: number): PatientVoiceSource[] {
  const start = index % Math.max(sources.length, 1);
  return [...sources.slice(start, start + 2), ...sources.slice(0, Math.max(0, start + 2 - sources.length))].slice(0, 2);
}

function postSource(post: PatientVoicePost): PatientVoiceSource | undefined {
  return {
    title: post.title ?? (post.source === "x" ? "Public X post" : "Public web signal"),
    url: post.url,
    source: post.source,
    snippet: cleanSnippet(post.text),
  };
}

function extractSources(context: string): PatientVoiceSource[] {
  try {
    const parsed = JSON.parse(context) as unknown;
    return collectRecords(parsed)
      .map(recordSource)
      .filter((item): item is PatientVoiceSource => Boolean(item))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(collectRecords);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(collectRecords)];
}

function recordSource(record: Record<string, unknown>): PatientVoiceSource | undefined {
  const url = text(record.url) ?? text(record.link);
  const summary = text(record.summary) ?? text(record.snippet) ?? text(record.content);
  const title = text(record.title) ?? titleFromUrl(url);
  if (!url && !summary) return undefined;
  return {
    title: title ?? "Public web signal",
    url,
    source: /(?:x|twitter)\.com/i.test(url ?? "") ? "x" : "web",
    snippet: cleanSnippet(summary ?? ""),
  };
}

function titleFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function cleanSnippet(value: string): string {
  return value.replace(/@\w+/g, "").replace(/\s+/g, " ").trim().slice(0, 260);
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
