import { getEnvValue } from "@/lib/env";
import { seedVoiceThemes, seedXPosts } from "@/lib/demo/seedXPosts";
import type { PatientProfile, PatientVoicePost, PatientVoiceTheme } from "@/lib/types";

export async function searchPatientVoice(patient: PatientProfile): Promise<{
  posts: PatientVoicePost[];
  themes: PatientVoiceTheme[];
  sourceMode: "real" | "mock";
  message?: string;
}> {
  const token = getEnvValue(["X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"]);
  if (!token) {
    return { posts: seedXPosts, themes: seedVoiceThemes, sourceMode: "mock", message: "X API credentials missing, using seeded demo signals" };
  }
  try {
    const params = new URLSearchParams({
      query: buildQuery(patient),
      max_results: "20",
      "tweet.fields": "created_at,lang",
    });
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`X API ${response.status}`);
    const json = (await response.json()) as { data?: Array<{ id: string; text: string; lang?: string }> };
    const posts = (json.data ?? [])
      .filter((post) => !post.lang || post.lang === "en")
      .map((post) => ({ id: post.id, text: sanitizePost(post.text), source: "x" as const }))
      .filter((post) => post.text.length > 20);
    if (posts.length === 0) {
      return { posts: seedXPosts, themes: seedVoiceThemes, sourceMode: "mock", message: "No relevant public posts found, using seeded demo signals" };
    }
    return { posts, themes: clusterVoice(posts), sourceMode: "real" };
  } catch (error) {
    return { posts: seedXPosts, themes: seedVoiceThemes, sourceMode: "mock", message: `X API unavailable, using seeded demo signals: ${safeError(error)}` };
  }
}

function buildQuery(patient: PatientProfile): string {
  const terms = [
    patient.biomarkers[0] ?? "EGFR",
    "clinical trial",
    "(biopsy OR travel OR reimbursement OR infusion OR fatigue OR caregiver OR screening)",
    "-is:retweet",
    "lang:en",
  ];
  return terms.join(" ");
}

function sanitizePost(text: string): string {
  return text
    .replace(/@\w+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clusterVoice(posts: PatientVoicePost[]): PatientVoiceTheme[] {
  const buckets = [
    makeTheme(posts, "Biopsy and tissue uncertainty", /biopsy|tissue|specimen|pathology/i, "Will screening require a fresh biopsy, or can prior tissue be used?"),
    makeTheme(posts, "Travel and reimbursement burden", /travel|parking|reimbursement|lodging|caregiver/i, "What travel, parking, lodging, or caregiver support is available?"),
    makeTheme(posts, "Visit schedule and fatigue", /visit|infusion|fatigue|screening|schedule/i, "What is the expected first-month schedule for visits, labs, scans, and infusions?"),
  ].filter((theme): theme is PatientVoiceTheme => Boolean(theme));
  return buckets.length ? buckets : seedVoiceThemes;
}

function makeTheme(
  posts: PatientVoicePost[],
  theme: string,
  pattern: RegExp,
  coordinatorQuestion: string,
): PatientVoiceTheme | undefined {
  const count = posts.filter((post) => pattern.test(post.text)).length;
  if (!count) return undefined;
  return {
    theme,
    sentiment: "mixed",
    signalStrength: count > 4 ? "high" : count > 1 ? "medium" : "low",
    summary: "Public posts surfaced this as an unverified patient-experience concern to ask about, not as medical evidence.",
    coordinatorQuestion,
    sourceCount: count,
  };
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
