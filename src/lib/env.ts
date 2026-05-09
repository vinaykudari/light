import fs from "node:fs";
import path from "node:path";
import type { CapabilityReport } from "./types";

type EnvMap = Record<string, string>;

let cachedFileEnv: EnvMap | undefined;

function readSharedEnv(): EnvMap {
  if (cachedFileEnv) return cachedFileEnv;
  const file = path.join(process.cwd(), ".env.shared");
  const parsed: EnvMap = {};
  if (!fs.existsSync(file)) {
    cachedFileEnv = parsed;
    return parsed;
  }
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key && value) parsed[key] = value;
  }
  cachedFileEnv = parsed;
  return parsed;
}

export function getEnvValue(names: string[]): string | undefined {
  const fileEnv = readSharedEnv();
  for (const name of names) {
    const value = process.env[name] ?? fileEnv[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export function hasEnv(names: string[]): boolean {
  return Boolean(getEnvValue(names));
}

export function getCapabilityReport(): CapabilityReport {
  return {
    clinicalTrials: true,
    pubMed: true,
    xPublicSearch: hasEnv(["X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"]),
    nia: hasEnv(["NIA_API_KEY", "NIA_BASE_URL"]),
    tensorlake: hasEnv(["TENSORLAKE_API_KEY", "TENSORLAKE_ENDPOINT"]),
    hyperspell: hasEnv(["HYPERSPELL_API_KEY", "HYPERSPELL_PROJECT_ID"]),
    llm: hasEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "COPENAI_API_KEY"]),
  };
}

export function capabilityMode(report: CapabilityReport): "real" | "mixed" | "mock" {
  const realCount = Object.values(report).filter(Boolean).length;
  if (realCount === 0) return "mock";
  if (realCount === Object.keys(report).length) return "real";
  return "mixed";
}
