import { getEnvValue } from "@/lib/env";
import { seedVoiceThemes, seedXPosts } from "@/lib/demo/seedXPosts";
import type { PatientProfile, PatientVoicePost, PatientVoiceTheme } from "@/lib/types";

type VoiceResult = {
  posts: PatientVoicePost[];
  themes: PatientVoiceTheme[];
  sourceMode: "real" | "mock";
  message?: string;
};

export async function searchPatientVoice(patient: PatientProfile): Promise<VoiceResult> {
  const xApi = await searchViaClawLocalizer(patient);
  const web = xApi.posts.length < 4 ? await searchPublicWeb(patient) : { posts: [] };
  const posts = dedupePosts([...xApi.posts, ...web.posts]).slice(0, 12);
  if (posts.length) {
    return {
      posts,
      themes: clusterVoice(posts),
      sourceMode: "real",
      message: buildMessage(xApi.message, web.posts.length),
    };
  }
  return {
    posts: seedXPosts,
    themes: seedVoiceThemes,
    sourceMode: "mock",
    message: `${xApi.message ?? "Claw localizer X API returned no usable posts"}; using seeded synthetic signals`,
  };
}

async function searchViaClawLocalizer(patient: PatientProfile): Promise<{ posts: PatientVoicePost[]; message?: string }> {
  const links = await discoverXStatusLinks(patient);
  if (!links.length) return { posts: [], message: "No candidate X status links found for Claw localizer hydration" };
  const settled = await Promise.allSettled(links.slice(0, 8).map(fetchViaLocalizer));
  const posts = settled
    .filter((item): item is PromiseFulfilledResult<PatientVoicePost | undefined> => item.status === "fulfilled")
    .map((item) => item.value)
    .filter((post): post is PatientVoicePost => Boolean(post))
    .filter((post) => isRelevantVoiceText(post.text));
  return {
    posts,
    message: `Claw localizer hydrated ${posts.length}/${links.slice(0, 8).length} X posts through its configured X API`,
  };
}

async function discoverXStatusLinks(patient: PatientProfile): Promise<string[]> {
  const token = getEnvValue(["BRAVE_API_KEY"]);
  if (!token) return [];
  const queries = [
    `site:x.com clinical trial patient travel biopsy reimbursement ${patient.biomarkers[0] ?? "cancer"}`,
    `site:x.com cancer clinical trial biopsy travel caregiver screening`,
    `site:x.com lung cancer clinical trial infusion fatigue caregiver`,
    `site:x.com EGFR clinical trial lung cancer`,
  ];
  const results = await Promise.allSettled(queries.map((query) => braveSearch(query, token)));
  return [...new Set(results.flatMap((result) => result.status === "fulfilled" ? result.value : []))];
}

async function braveSearch(query: string, token: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query, count: "10", search_lang: "en", country: "us" });
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": token },
  });
  if (!response.ok) return [];
  const json = (await response.json()) as { web?: { results?: Array<{ url?: string }> } };
  return (json.web?.results ?? []).flatMap((result) => {
    const url = result.url ?? "";
    const id = url.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i)?.[1];
    return id ? [`https://x.com/i/status/${id}`] : [];
  });
}

async function fetchViaLocalizer(link: string): Promise<PatientVoicePost | undefined> {
  const base = getEnvValue(["XLOCALIZER_API_BASE", "CLAWLOCALIZER_API_BASE"]) ?? "http://127.0.0.1:4188";
  const response = await fetch(`${base.replace(/\/$/, "")}/v1/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link, target_language: "en", render_image: false }),
  });
  if (!response.ok) return undefined;
  const json = (await response.json()) as { source_post_id?: string; original_text?: string };
  const text = sanitizePost(json.original_text ?? "");
  if (text.length < 25) return undefined;
  return { id: json.source_post_id ?? link, text, source: "x" };
}

async function searchPublicWeb(patient: PatientProfile): Promise<{ posts: PatientVoicePost[] }> {
  const token = getEnvValue(["BRAVE_API_KEY"]);
  if (!token) return { posts: [] };
  try {
    const params = new URLSearchParams({
      q: [
        "site:x.com OR site:reddit.com",
        patient.biomarkers[0] ?? "EGFR exon 20",
        "clinical trial biopsy travel reimbursement infusion fatigue caregiver screening",
      ].join(" "),
      count: "10",
      search_lang: "en",
      country: "us",
    });
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": token },
    });
    if (!response.ok) throw new Error("public web search failed");
    const json = (await response.json()) as { web?: { results?: Array<{ title?: string; description?: string }> } };
    return {
      posts: (json.web?.results ?? [])
        .map((result, index) => ({ id: `web-${index}`, text: sanitizePost(`${result.title ?? ""}. ${result.description ?? ""}`), source: "web" as const }))
        .filter((post) => post.text.length > 30),
    };
  } catch {
    return { posts: [] };
  }
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

function isRelevantVoiceText(text: string): boolean {
  return /trial|cancer|lung|egfr|biopsy|travel|caregiver|screening|infusion|fatigue|reimburse/i.test(text);
}

function clusterVoice(posts: PatientVoicePost[]): PatientVoiceTheme[] {
  const buckets = [
    makeTheme(posts, "Biopsy and tissue uncertainty", /biopsy|tissue|specimen|pathology/i, "Will screening require a fresh biopsy, or can prior tissue be used?"),
    makeTheme(posts, "Travel and reimbursement burden", /travel|parking|reimbursement|lodging|caregiver/i, "What travel, parking, lodging, or caregiver support is available?"),
    makeTheme(posts, "Visit schedule and fatigue", /visit|infusion|fatigue|screening|schedule/i, "What is the expected first-month schedule for visits, labs, scans, and infusions?"),
    makeTheme(posts, "Trial awareness and pre-screening", /trial|screening|enroll|recruit/i, "What pre-screening records should be sent before the patient commits time to a visit?"),
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
    summary: "X API hydrated posts and public snippets surfaced this as an unverified patient-experience signal to ask about, not medical evidence.",
    coordinatorQuestion,
    sourceCount: count,
  };
}

function dedupePosts(posts: PatientVoicePost[]): PatientVoicePost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = `${post.source}:${post.id}:${post.text.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMessage(xMessage: string | undefined, webCount: number): string {
  return [xMessage, webCount ? `added ${webCount} public web snippets for burden coverage` : undefined]
    .filter(Boolean)
    .join("; ");
}
