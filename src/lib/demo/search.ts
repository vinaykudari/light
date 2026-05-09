import {
  seededExtraction,
  seededInsights,
  seededPosts,
  seededPublications,
  seededTrials,
} from "./seed";

export function searchSeededTrials(query: string, maxResults = 6) {
  return rankByQuery(seededTrials, query).slice(0, maxResults);
}

export function searchSeededPublications(query: string, maxResults = 6) {
  return rankByQuery(seededPublications, query).slice(0, maxResults);
}

export function searchSeededPosts(query: string, maxResults = 6) {
  return rankByQuery(seededPosts, query).slice(0, maxResults);
}

export function searchSeededInsights(query: string, maxResults = 4) {
  return rankByQuery(seededInsights, query).slice(0, maxResults);
}

export function fallbackExtraction() {
  return seededExtraction;
}

export function fallbackLlmText(prompt: string): string {
  const insights = searchSeededInsights(prompt, 2)
    .map((item) => `${item.title}: ${item.snippet}`)
    .join(" ");
  return insights || "Seeded fallback: combine trial status, eligibility burden, and patient voice signals.";
}

function rankByQuery<T>(items: T[], query: string): T[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  if (terms.length === 0) {
    return [...items];
  }

  return [...items].sort((left, right) => score(right, terms) - score(left, terms));
}

function score(value: unknown, terms: string[]): number {
  const haystack = JSON.stringify(value).toLowerCase();
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}
