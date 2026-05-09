import { getEnvValue } from "@/lib/env";
import { searchNiaPatientVoice } from "@/lib/adapters/niaAdapter";
import { synthesizeVoiceThemesWithLlm } from "@/lib/llm/patientVoiceSynthesis";
import type { PatientProfile, PatientVoicePost, PatientVoiceTheme, SourceMode } from "@/lib/types";

type VoiceResult = {
  posts: PatientVoicePost[];
  themes: PatientVoiceTheme[];
  sourceMode: SourceMode;
  message?: string;
};

type XSearchResponse = {
  data?: Array<{ id?: string; text?: string }>;
};

export async function searchPatientVoice(patient: PatientProfile): Promise<VoiceResult> {
  const officialX = await searchViaOfficialX(patient);
  const clawX = officialX.posts.length ? { posts: [], message: "Claw localizer hydration skipped because official X API returned posts" } : await searchViaClawLocalizer(patient);
  const handoff = [officialX.message, clawX.message].filter(Boolean).join("; ");
  const posts = dedupePosts([...officialX.posts, ...clawX.posts]).slice(0, 12);
  if (posts.length) {
    const synthesis = await synthesizeVoiceThemesWithLlm(patient, posts);
    return {
      posts,
      themes: synthesis.themes,
      sourceMode: synthesis.sourceMode,
      message: handoff,
    };
  }
  const nia = await searchNiaPatientVoice(patient);
  if (nia.themes.length) {
    return {
      posts: [],
      themes: nia.themes,
      sourceMode: nia.sourceMode,
      message: `${handoff || "X APIs returned no usable posts"}; ${nia.message}`,
    };
  }
  if (isSymptomProfile(patient)) {
    return {
      posts: [],
      themes: [],
      sourceMode: "real",
      message: `${handoff || "X APIs returned no usable posts"}; ${nia.message ?? "Nia returned no aggregate patient voice themes"}`,
    };
  }
  return {
    posts: [],
    themes: [],
    sourceMode: "real",
    message: `${handoff || "X APIs returned no usable posts"}; ${nia.message ?? "Nia returned no aggregate patient voice themes"}`,
  };
}

async function searchViaOfficialX(patient: PatientProfile): Promise<{ posts: PatientVoicePost[]; message?: string }> {
  const token = getEnvValue(["X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"]);
  if (!token) return { posts: [], message: "Official X API bearer token is not configured" };
  const settled = await Promise.allSettled(buildVoiceQueries(patient).slice(0, 3).map((query) => fetchOfficialXQuery(token, query)));
  const messages: string[] = [];
  const posts = settled.flatMap((item) => {
    if (item.status === "rejected") {
      messages.push("Official X recent search request failed");
      return [];
    }
    if (item.value.message) messages.push(item.value.message);
    return item.value.posts;
  });
  const uniqueMessages = [...new Set(messages)].slice(0, 2).join("; ");
  return {
    posts,
    message: posts.length
      ? `Official X API returned ${posts.length} sanitized public posts`
      : uniqueMessages || "Official X API returned no usable posts",
  };
}

async function fetchOfficialXQuery(token: string, query: string): Promise<{ posts: PatientVoicePost[]; message?: string }> {
  const params = new URLSearchParams({
    query: formatXQuery(query),
    max_results: "10",
    "tweet.fields": "lang,created_at",
  });
  const response = await fetchWithTimeout(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  }, 7000);
  if (!response.ok) return { posts: [], message: `Official X recent search returned HTTP ${response.status}` };
  const json = (await response.json()) as XSearchResponse;
  const posts = (json.data ?? []).flatMap((tweet) => {
    const text = sanitizePost(tweet.text ?? "");
    return tweet.id && text.length > 25 ? [{ id: tweet.id, text, source: "x" as const }] : [];
  });
  return { posts };
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
  const base = getEnvValue(["XLOCALIZER_API_BASE", "CLAWLOCALIZER_API_BASE"]) ?? "http://127.0.0.1:4188";
  try {
    const settled = await Promise.allSettled(buildVoiceQueries(patient).slice(0, 4).map(async (query) => {
      const params = new URLSearchParams({ q: query, limit: "10" });
      const response = await fetchWithTimeout(`${base.replace(/\/$/, "")}/v1/search?${params.toString()}`, {}, 5000);
      if (!response.ok) return [];
      return extractLinks(await response.json());
    }));
    return [...new Set(settled.flatMap((item) => item.status === "fulfilled" ? item.value : []))];
  } catch {
    return [];
  }
}

async function fetchViaLocalizer(link: string): Promise<PatientVoicePost | undefined> {
  const base = getEnvValue(["XLOCALIZER_API_BASE", "CLAWLOCALIZER_API_BASE"]) ?? "http://127.0.0.1:4188";
  const response = await fetchWithTimeout(`${base.replace(/\/$/, "")}/v1/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link, target_language: "en", render_image: false }),
  }, 5000);
  if (!response.ok) return undefined;
  const json = (await response.json()) as { source_post_id?: string; original_text?: string };
  const text = sanitizePost(json.original_text ?? "");
  if (text.length < 25) return undefined;
  return { id: json.source_post_id ?? link, text, source: "x" };
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
  return text.trim().length > 25;
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

function buildVoiceQueries(patient: PatientProfile): string[] {
  const condition = compactCondition(patient.possibleConditionContext ?? patient.diagnosis);
  const symptoms = (patient.symptoms?.length ? patient.symptoms : patient.biomarkers).slice(0, 5).join(" ");
  return unique([
    `${condition} ${symptoms} clinical trial patient experience`,
    `${condition} ${symptoms} travel reimbursement visit burden`,
    `${condition} ${symptoms} symptoms research study`,
    `${condition} ${symptoms} patient reported outcomes`,
  ]);
}

function formatXQuery(query: string): string {
  return `${query.replace(/["']/g, " ").slice(0, 220)} -is:retweet lang:en`;
}

function compactCondition(condition: string): string {
  return condition.split(/\bwith\b|[,;(/]/i)[0]?.trim() || condition;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function isSymptomProfile(patient: PatientProfile): boolean {
  return Boolean(patient.symptoms?.length || patient.possibleConditionContext || patient.patientGoal);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(json: unknown): string[] {
  const links = collectStrings(json).flatMap((value) => {
    const id = value.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i)?.[1] ?? value.match(/\bstatus\/(\d{8,})\b/i)?.[1];
    return id ? [`https://x.com/i/status/${id}`] : [];
  });
  return [...new Set(links)];
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}
