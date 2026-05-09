import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnvValue } from "@/lib/env";

export async function generateText(prompt: string): Promise<{
  text: string;
  sourceMode: "real" | "mock";
}> {
  const geminiKey = getEnvValue(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (!geminiKey) return { text: deterministicText(prompt), sourceMode: "mock" };
  try {
    const client = new GoogleGenerativeAI(geminiKey);
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return { text: result.response.text(), sourceMode: "real" };
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
