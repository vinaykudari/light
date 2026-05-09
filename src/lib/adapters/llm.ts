import { fallbackLlmText } from "@/lib/demo";
import type { AdapterSingle, LlmInput, LlmMessage, LlmResult } from "./types";
import { resolveEnv } from "./env";
import { asArray, asNumber, asRecord, asString, fetchJson, reasonFromError } from "./http";
import { cleanText } from "./privacy";

const SOURCE = "LLM";

export async function completeWithLlm(input: LlmInput): Promise<AdapterSingle<LlmResult>> {
  const messages = normalizeMessages(input);

  try {
    const custom = await tryCustomEndpoint(input, messages);
    if (custom) {
      return activeLlm(custom);
    }

    const openai = await tryOpenAI(input, messages);
    if (openai) {
      return activeLlm(openai);
    }

    const anthropic = await tryAnthropic(input, messages);
    if (anthropic) {
      return activeLlm(anthropic);
    }

    const gemini = await tryGemini(input, messages);
    if (gemini) {
      return activeLlm(gemini);
    }

    return fallbackLlm(input, "no LLM provider is configured");
  } catch (error) {
    return fallbackLlm(input, reasonFromError(error));
  }
}

function normalizeMessages(input: LlmInput): LlmMessage[] {
  if (input.messages?.length) {
    return input.messages;
  }
  return [{ role: "user", content: input.prompt ?? "" }];
}

async function tryCustomEndpoint(
  input: LlmInput,
  messages: LlmMessage[],
): Promise<LlmResult | undefined> {
  const endpoint = await resolveEnv("LIGHT_LLM_ENDPOINT");
  if (!endpoint) {
    return undefined;
  }
  const token = await resolveEnv("LIGHT_LLM_API_KEY");
  const data = await fetchJson<unknown>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildChatBody(input, messages)),
  });
  return mapOpenAIStyle(data, input.model ?? "custom", "custom");
}

async function tryOpenAI(input: LlmInput, messages: LlmMessage[]): Promise<LlmResult | undefined> {
  const token = await resolveEnv("OPENAI_API_KEY");
  if (!token) {
    return undefined;
  }
  const model = input.model ?? (await resolveEnv("OPENAI_MODEL")) ?? "gpt-4o-mini";
  const data = await fetchJson<unknown>("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildChatBody({ ...input, model }, messages)),
  });
  return mapOpenAIStyle(data, model, "openai");
}

async function tryAnthropic(input: LlmInput, messages: LlmMessage[]): Promise<LlmResult | undefined> {
  const token = await resolveEnv("ANTHROPIC_API_KEY");
  if (!token) {
    return undefined;
  }
  const model = input.model ?? (await resolveEnv("ANTHROPIC_MODEL")) ?? "claude-3-5-haiku-latest";
  const system = messages.find((message) => message.role === "system")?.content;
  const data = await fetchJson<unknown>("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? 800,
      temperature: input.temperature ?? 0.2,
      system,
      messages: messages.filter((message) => message.role !== "system"),
    }),
  });
  return mapAnthropic(data, model);
}

async function tryGemini(input: LlmInput, messages: LlmMessage[]): Promise<LlmResult | undefined> {
  const token = await resolveEnv("GEMINI_API_KEY", ["GOOGLE_API_KEY"]);
  if (!token) {
    return undefined;
  }
  const model = input.model ?? (await resolveEnv("GEMINI_MODEL")) ?? "gemini-1.5-flash";
  const data = await fetchJson<unknown>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: messages.map((m) => m.content).join("\n\n") }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: input.maxTokens ?? 800,
        },
      }),
    },
  );
  return mapGemini(data, model);
}

function buildChatBody(input: LlmInput, messages: LlmMessage[]) {
  return {
    model: input.model,
    messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 800,
  };
}

function mapOpenAIStyle(data: unknown, model: string, provider: string): LlmResult {
  const record = asRecord(data);
  const choice = asRecord(asArray(record.choices)[0]);
  const message = asRecord(choice.message);
  const usage = asRecord(record.usage);
  return {
    id: asString(record.id) ?? `${provider}-response`,
    provider,
    model,
    text: cleanText(message.content ?? choice.text, 4000),
    usage: {
      inputTokens: asNumber(usage.prompt_tokens),
      outputTokens: asNumber(usage.completion_tokens),
    },
  };
}

function mapAnthropic(data: unknown, model: string): LlmResult {
  const record = asRecord(data);
  const block = asRecord(asArray(record.content)[0]);
  const usage = asRecord(record.usage);
  return {
    id: asString(record.id) ?? "anthropic-response",
    provider: "anthropic",
    model,
    text: cleanText(block.text, 4000),
    usage: {
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens),
    },
  };
}

function mapGemini(data: unknown, model: string): LlmResult {
  const candidate = asRecord(asArray(asRecord(data).candidates)[0]);
  const parts = asArray(asRecord(candidate.content).parts);
  return {
    id: "gemini-response",
    provider: "gemini",
    model,
    text: cleanText(parts.map((part) => asString(asRecord(part).text)).join("\n"), 4000),
  };
}

function activeLlm(item: LlmResult): AdapterSingle<LlmResult> {
  return { source: SOURCE, mode: "active", fetchedAt: new Date().toISOString(), item };
}

function fallbackLlm(input: LlmInput, reason: string): AdapterSingle<LlmResult> {
  const prompt = input.prompt ?? input.messages?.map((message) => message.content).join("\n") ?? "";
  return {
    source: SOURCE,
    mode: "fallback",
    reason,
    fetchedAt: new Date().toISOString(),
    item: {
      id: "seed-llm-response",
      provider: "seeded",
      model: "seeded-fallback",
      text: fallbackLlmText(prompt),
    },
  };
}
