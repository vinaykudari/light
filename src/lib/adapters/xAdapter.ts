import { getEnvValue } from "@/lib/env";
import { seedVoiceThemes, seedXPosts } from "@/lib/demo/seedXPosts";
import type { PatientProfile, PatientVoicePost, PatientVoiceTheme } from "@/lib/types";

export async function searchPatientVoice(patient: PatientProfile): Promise<{
  posts: PatientVoicePost[];
  themes: PatientVoiceTheme[];
  sourceMode: "real" | "mock";
  message?: string;
}> {
  const x = await searchX(patient);
  if (x.posts.length) return { posts: x.posts, themes: clusterVoice(x.posts), sourceMode: "real" };

  const web = await searchPublicWeb(patient);
  if (web.posts.length) {
    return {
      posts: web.posts,
      themes: clusterVoice(web.posts),
      sourceMode: "real",
      message: x.message ? `${x.message}; using live public web search snippets` : "Using live public web search snippets",
    };
  }

  return {
    posts: seedXPosts,
    themes: seedVoiceThemes,
    sourceMode: "mock",
    message: `${x.message ?? "X API unavailable"}; public web search unavailable, using seeded synthetic signals`,
  };
}

async function searchX(patient: PatientProfile): Promise<{ posts: PatientVoicePost[]; message?: string }> {
  const token = getEnvValue(["X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"]);
  if (!token) return { posts: [], message: "X API credentials missing" };
  try {
    const params = new URLSearchParams({
      query: buildXQuery(patient),
      max_results: "20",
      "tweet.fields": "created_at,lang",
    });
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`X API ${response.status}`);
    const json = (await response.json()) as { data?: Array<{ id: string; text: string; lang?: string }> };
    return {
      posts: (json.data ?? [])
        .filter((post) => !post.lang || post.lang === "en")
        .map((post) => ({ id: post.id, text: sanitizePost(post.text), source: "x" as const }))
        .filter((post) => post.text.length > 20),
    };
  } catch (error) {
    return { posts: [], message: `X recent search unavailable: ${safeError(error)}` };
  }
}

async function searchPublicWeb(patient: PatientProfile): Promise<{ posts: PatientVoicePost[] }> {
  const token = getEnvValue(["BRAVE_API_KEY"]);
  if (!token) return { posts: [] };
  try {
    const params = new URLSearchParams({
      q: buildWebQuery(patient),
      count: "10",
      search_lang: "en",
      country: "us",
    });
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": token },
    });
    if (!response.ok) throw new Error(`Brave Search ${response.status}`);
    const json = (await response.json()) as { web?: { results?: Array<{ title?: string; description?: string }> } };
    return {
      posts: (json.web?.results ?? [])
        .map((result, index) => ({
          id: `web-${index}`,
          text: sanitizePost(`${result.title ?? ""}. ${result.description ?? ""}`),
          source: "web" as const,
        }))
        .filter((post) => post.text.length > 30),
    };
  } catch {
    return { posts: [] };
  }
}

function buildXQuery(patient: PatientProfile): string {
  return [
    patient.biomarkers[0] ?? "EGFR",
    "clinical trial",
    "(biopsy OR travel OR reimbursement OR infusion OR fatigue OR caregiver OR screening)",
    "-is:retweet",
    "lang:en",
  ].join(" ");
}

function buildWebQuery(patient: PatientProfile): string {
  return [
    "site:x.com OR site:reddit.com",
    patient.biomarkers[0] ?? "EGFR exon 20",
    "clinical trial",
    "biopsy travel reimbursement infusion fatigue caregiver screening",
  ].join(" ");
}

function sanitizePost(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/@\w+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b[A-Z][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, "")
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
    summary: "Live public snippets surfaced this as an unverified patient-experience concern to ask about, not as medical evidence.",
    coordinatorQuestion,
    sourceCount: count,
  };
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
