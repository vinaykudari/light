import crypto from "node:crypto";
import { getEnvValue } from "@/lib/env";
import { seedClinicMemory } from "@/lib/demo/seedClinicMemory";
import type { SourceMode } from "@/lib/types";

export async function loadClinicMemory(): Promise<{
  memories: string[];
  sourceMode: SourceMode;
  message?: string;
}> {
  const auth = buildAuth();
  if (!auth) {
    return {
      memories: seedClinicMemory,
      sourceMode: "mock",
      message: "Hyperspell unavailable, using seeded clinic memory",
    };
  }
  try {
    const json = await queryMemory(auth);
    const memories = mapMemories(json);
    if (memories.length) {
      return {
        memories,
        sourceMode: "real",
        message: `Hyperspell recalled ${memories.length} clinic/team memory items`,
      };
    }
    return {
      memories: seedClinicMemory,
      sourceMode: "mixed",
      message: "Hyperspell connected but no matching clinic memory is indexed yet, using seeded clinic memory",
    };
  } catch {
    return {
      memories: seedClinicMemory,
      sourceMode: "mock",
      message: "Hyperspell request failed, using seeded clinic memory",
    };
  }
}

type HyperspellAuth = {
  token: string;
  userId?: string;
  usesUserJwt: boolean;
};

async function queryMemory(auth: HyperspellAuth): Promise<Record<string, unknown>> {
  const base = getEnvValue(["HYPERSPELL_BASE_URL"]) ?? "https://api.hyperspell.com";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
  };
  if (auth.userId && !auth.usesUserJwt) headers["X-As-User"] = auth.userId;
  const response = await fetch(`${base.replace(/\/$/, "")}/memories/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: "Light clinical trial coordinator memory for EGFR exon 20 NSCLC brain metastases biopsy reimbursement",
      answer: true,
      options: { max_results: 5 },
    }),
  });
  if (!response.ok) throw new Error("Hyperspell query failed");
  return response.json() as Promise<Record<string, unknown>>;
}

function buildAuth(): HyperspellAuth | undefined {
  const apiToken = getEnvValue(["HYPERSPELL_API_KEY", "HYPERSPELL_TOKEN"]);
  const userId = getEnvValue(["HYPERSPELL_USER_ID", "HYPERSPELL_AS_USER"]) ?? "light-demo";
  if (apiToken) return { token: apiToken, userId, usesUserJwt: false };
  const secret = getEnvValue(["HYPERSPELL_JWT_SECRET"]);
  const appId = getEnvValue(["HYPERSPELL_APP_ID", "HYPERSPELL_APP_NAME"]);
  if (!secret || !appId) return undefined;
  return {
    token: signJwt(secret, {
      sub: userId,
      user_id: userId,
      ref: appId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    usesUserJwt: true,
  };
}

function signJwt(secret: string, payload: Record<string, string | number>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function mapMemories(json: Record<string, unknown>): string[] {
  const docs = Array.isArray(json.documents) ? json.documents : [];
  const documentText = docs
    .map((doc) => isRecord(doc) ? cleanText(doc.title ?? doc.text ?? doc.content ?? doc.summary) : undefined)
    .filter((item): item is string => Boolean(item));
  const answer = cleanText(json.answer);
  return [...documentText, answer].filter((item): item is string => Boolean(item)).slice(0, 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown): string | undefined {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean ? clean.slice(0, 500) : undefined;
}
