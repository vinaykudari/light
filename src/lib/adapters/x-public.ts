import { searchSeededPosts } from "@/lib/demo";
import type { AdapterResult, SearchInput, SocialPost } from "./types";
import { resolveEnv } from "./env";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  buildUrl,
  clamp,
  fetchJson,
  reasonFromError,
} from "./http";
import { cleanText } from "./privacy";

const SOURCE = "X public search";
const RECENT_SEARCH_URL = "https://api.x.com/2/tweets/search/recent";

export async function searchXPublic(input: SearchInput): Promise<AdapterResult<SocialPost>> {
  const maxResults = clamp(input.maxResults, 10, 1, 25);
  const token = await resolveEnv("X_BEARER_TOKEN", [
    "TWITTER_BEARER_TOKEN",
    "X_API_BEARER_TOKEN",
  ]);

  if (!token) {
    return fallbackX(input, "X bearer token is not configured", maxResults);
  }

  try {
    const data = await fetchJson<unknown>(
      buildUrl(RECENT_SEARCH_URL, {
        query: `${input.query} -is:retweet lang:en`,
        max_results: Math.max(10, maxResults),
        "tweet.fields": "created_at,public_metrics,lang",
      }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const items = asArray(asRecord(data).data).map(mapPost).slice(0, maxResults);

    return {
      source: SOURCE,
      mode: "active",
      fetchedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return fallbackX(input, reasonFromError(error), maxResults);
  }
}

function fallbackX(input: SearchInput, reason: string, maxResults: number): AdapterResult<SocialPost> {
  return {
    source: SOURCE,
    mode: "fallback",
    reason,
    fetchedAt: new Date().toISOString(),
    items: searchSeededPosts(input.query, maxResults),
  };
}

function mapPost(value: unknown): SocialPost {
  const post = asRecord(value);
  const id = asString(post.id) ?? crypto.randomUUID();
  const metrics = asRecord(post.public_metrics);

  return {
    id,
    text: cleanText(post.text, 500),
    createdAt: asString(post.created_at),
    url: `https://x.com/i/web/status/${encodeURIComponent(id)}`,
    sourceLabel: "Public X post",
    metrics: {
      likes: asNumber(metrics.like_count),
      replies: asNumber(metrics.reply_count),
      reposts: asNumber(metrics.retweet_count),
    },
  };
}
