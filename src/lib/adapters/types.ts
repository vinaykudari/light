export type AdapterMode = "active" | "fallback";

export interface AdapterMeta {
  source: string;
  mode: AdapterMode;
  fetchedAt: string;
  reason?: string;
  warnings?: string[];
}

export interface AdapterResult<T> extends AdapterMeta {
  items: T[];
}

export interface AdapterSingle<T> extends AdapterMeta {
  item: T;
}

export interface AdapterCapability {
  id: string;
  label: string;
  mode: AdapterMode;
  reason: string;
  env?: string[];
}

export interface SearchInput {
  query: string;
  maxResults?: number;
}

export interface TrialSearchInput extends SearchInput {
  condition?: string;
  location?: string;
  statuses?: string[];
  pageSize?: number;
}

export interface TrialRecord {
  id: string;
  nctId: string;
  title: string;
  status: string;
  phase?: string;
  conditions: string[];
  interventions: string[];
  sponsor?: string;
  locations: string[];
  eligibilitySummary?: string;
  lastUpdated?: string;
  url: string;
}

export interface PublicationRecord {
  id: string;
  pmid: string;
  title: string;
  journal?: string;
  publishedAt?: string;
  authors: string[];
  doi?: string;
  url: string;
  summary?: string;
}

export interface SocialPost {
  id: string;
  text: string;
  createdAt?: string;
  url?: string;
  sourceLabel: string;
  metrics?: {
    likes?: number;
    replies?: number;
    reposts?: number;
  };
}

export interface ResearchInsight {
  id: string;
  title: string;
  snippet: string;
  source: string;
  url?: string;
  score?: number;
}

export interface DocumentExtraction {
  id: string;
  status: string;
  title?: string;
  parseId?: string;
  content?: string;
  chunks?: string[];
  structured?: unknown;
  source: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmInput {
  prompt?: string;
  messages?: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResult {
  id: string;
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}
