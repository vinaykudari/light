import { getEnvValue } from "@/lib/env";

export async function generateText(prompt: string): Promise<{
  text: string;
  sourceMode: "real" | "mock";
}> {
  const openAiKey = getEnvValue(["OPENAI_API_KEY", "COPENAI_API_KEY"]);
  if (openAiKey) {
    const openAi = await generateOpenAi(prompt, openAiKey);
    if (openAi.sourceMode === "real") return openAi;
  }
  const geminiKey = getEnvValue(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (geminiKey) return generateGemini(prompt, geminiKey);
  return { text: deterministicText(prompt), sourceMode: "mock" };
}

export function hasLlmProvider(): boolean {
  return Boolean(getEnvValue(["OPENAI_API_KEY", "COPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"]));
}

async function generateOpenAi(prompt: string, key: string): Promise<{ text: string; sourceMode: "real" | "mock" }> {
  try {
    const model = getEnvValue(["LIGHT_LLM_MODEL", "OPENAI_MODEL"]) ?? "gpt-5-mini";
    const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are Light, a clinical-trial referral-prep assistant. Return educational, clinician-reviewed trial discussion content only. Do not diagnose, recommend treatment, determine eligibility, or include usernames.",
              },
            ],
          },
          { role: "user", content: [{ type: "input_text", text: prompt }] },
        ],
        max_output_tokens: 3000,
      }),
    }, 45000);
    if (!response.ok) throw new Error("OpenAI request failed");
    const json = await response.json();
    const text = extractOpenAiText(json);
    if (!text) throw new Error("OpenAI response had no text");
    return { text, sourceMode: "real" };
  } catch {
    return { text: deterministicText(prompt), sourceMode: "mock" };
  }
}

async function generateGemini(prompt: string, key: string): Promise<{ text: string; sourceMode: "real" | "mock" }> {
  try {
    const model = getEnvValue(["GEMINI_MODEL"]) ?? "gemini-2.5-flash";
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    }, 20000);
    if (!response.ok) throw new Error("Gemini request failed");
    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (!text) throw new Error("Gemini response had no text");
    return { text, sourceMode: "real" };
  } catch {
    return { text: deterministicText(prompt), sourceMode: "mock" };
  }
}

export async function generateStructured<T>(
  prompt: string,
  fallback: T,
): Promise<{ value: T; sourceMode: "real" | "mock" }> {
  const result = await generateText(prompt);
  if (result.sourceMode === "mock") return { value: fallback, sourceMode: "mock" };
  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return { value: fallback, sourceMode: "mock" };
    return { value: JSON.parse(match[0]) as T, sourceMode: "real" };
  } catch {
    return { value: fallback, sourceMode: "mock" };
  }
}

function deterministicText(prompt: string): string {
  const subject = prompt.split(/\s+/).slice(0, 16).join(" ");
  return `Deterministic fallback synthesis for clinician-reviewed education. Context: ${subject}`;
}

function extractOpenAiText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const record = json as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text.trim();
  const output = Array.isArray(record.output) ? record.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const record = part as Record<string, unknown>;
      const text = record.text ?? record.output_text;
      return typeof text === "string" ? [text] : [];
    });
  }).join("").trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
