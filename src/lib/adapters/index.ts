import { hasEnv } from "./env";

export * from "./types";
export * from "./clinical-trials";
export * from "./pubmed";
export * from "./x-public";
export * from "./nia";
export * from "./tensorlake";
export * from "./hyperspell";
export * from "./llm";

import type { AdapterCapability } from "./types";

export async function getExternalAdapterCapabilities(): Promise<AdapterCapability[]> {
  const [x, nia, tensorlake, hyperspell, customLlm, openai, anthropic, gemini] =
    await Promise.all([
      hasEnv("X_BEARER_TOKEN", ["TWITTER_BEARER_TOKEN", "X_API_BEARER_TOKEN"]),
      hasEnv("NIA_API_KEY", ["NIA_TOKEN"]),
      hasEnv("TENSORLAKE_API_KEY", ["TENSORLAKE_TOKEN"]),
      hasEnv("HYPERSPELL_TOKEN", ["HYPERSPELL_API_KEY"]),
      hasEnv("LIGHT_LLM_ENDPOINT"),
      hasEnv("OPENAI_API_KEY"),
      hasEnv("ANTHROPIC_API_KEY"),
      hasEnv("GEMINI_API_KEY", ["GOOGLE_API_KEY"]),
    ]);

  return [
    activePublic("clinical-trials", "ClinicalTrials.gov", "public API with seeded fallback"),
    activePublic("pubmed", "PubMed/NCBI", "public E-utilities API with seeded fallback"),
    keyed("x-public", "X public search", x, ["X_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"]),
    keyed("nia", "Nia", nia, ["NIA_API_KEY", "NIA_TOKEN"]),
    keyed("tensorlake", "Tensorlake", tensorlake, ["TENSORLAKE_API_KEY"]),
    keyed("hyperspell", "Hyperspell", hyperspell, ["HYPERSPELL_TOKEN", "HYPERSPELL_API_KEY"]),
    {
      id: "llm",
      label: "LLM",
      mode: customLlm || openai || anthropic || gemini ? "active" : "fallback",
      reason:
        customLlm || openai || anthropic || gemini
          ? "configured provider available"
          : "no LLM provider configured; seeded response available",
      env: [
        "LIGHT_LLM_ENDPOINT",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
      ],
    },
  ];
}

function activePublic(id: string, label: string, reason: string): AdapterCapability {
  return { id, label, mode: "active", reason };
}

function keyed(id: string, label: string, configured: boolean, env: string[]): AdapterCapability {
  return {
    id,
    label,
    mode: configured ? "active" : "fallback",
    reason: configured ? "credentials configured" : "credentials absent; seeded fallback available",
    env,
  };
}
