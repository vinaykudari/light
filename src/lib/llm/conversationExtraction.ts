import { generateStructured } from "@/lib/adapters/llmAdapter";
import type { ConversationTurn, PatientProfile } from "@/lib/types";

export type ConversationExtraction = {
  possibleConditionContext: string;
  symptoms: string[];
  duration: string;
  onset: string;
  location: string;
  patientGoal: string;
  age?: number;
  followUpQuestions: string[];
};

export async function extractConversationWithLlm(
  transcript: ConversationTurn[],
  base: PatientProfile,
): Promise<{ extraction: ConversationExtraction; sourceMode: "real" | "mock" }> {
  const fallback = fallbackExtraction(transcript, base);
  const prompt = [
    "Extract a de-identified clinical-trial research profile from this doctor/patient transcript.",
    "Return only JSON with keys: possibleConditionContext, symptoms, duration, onset, location, patientGoal, age, followUpQuestions.",
    "Do not diagnose. Use condition context only when the transcript directly supports it. Use the concise recognized research or disease name when the transcript clearly supports one, instead of a generic symptom cluster.",
    "The symptoms array must contain patient-described symptom phrases from the transcript, normalized to clinical-trial search language.",
    "The possibleConditionContext must be the research/disease context directly supported by the transcript, or a generic symptom cluster only if no context is supported.",
    `Base profile: ${JSON.stringify(base)}`,
    `Transcript: ${JSON.stringify(transcript)}`,
  ].join("\n");
  const result = await generateStructured<ConversationExtraction>(prompt, fallback);
  const extraction = normalize(result.value, fallback);
  if (result.sourceMode === "real" && (!extraction.symptoms.length || /generic|symptom cluster/i.test(extraction.possibleConditionContext))) {
    const retry = await generateStructured<ConversationExtraction>([
      "Your previous extraction missed the clinical symptoms or condition context. Re-extract from the transcript.",
      "Return only valid JSON with possibleConditionContext, symptoms, duration, onset, location, patientGoal, age, followUpQuestions.",
      "Do not diagnose, but do extract patient-described symptoms and the concise recognized research or disease context explicitly supported by the transcript.",
      `Transcript: ${JSON.stringify(transcript)}`,
    ].join("\n"), fallback);
    return { extraction: normalize(retry.value, fallback), sourceMode: retry.sourceMode };
  }
  return { extraction, sourceMode: result.sourceMode };
}

function normalize(value: ConversationExtraction, fallback: ConversationExtraction): ConversationExtraction {
  return {
    possibleConditionContext: text(value.possibleConditionContext) ?? fallback.possibleConditionContext,
    symptoms: list(value.symptoms, fallback.symptoms),
    duration: text(value.duration) ?? fallback.duration,
    onset: text(value.onset) ?? fallback.onset,
    location: text(value.location) ?? fallback.location,
    patientGoal: text(value.patientGoal) ?? fallback.patientGoal,
    age: typeof value.age === "number" ? value.age : fallback.age,
    followUpQuestions: list(value.followUpQuestions, fallback.followUpQuestions).slice(0, 10),
  };
}

function fallbackExtraction(transcript: ConversationTurn[], base: PatientProfile): ConversationExtraction {
  const textBlob = transcript.map((turn) => turn.text).join(" ");
  const symptoms = base.symptoms?.length ? base.symptoms : [];
  const condition = !/symptom conversation pending/i.test(base.diagnosis) ? base.diagnosis : "Symptom cluster for clinician review";
  return {
    possibleConditionContext: condition,
    symptoms,
    duration: textBlob.match(/(\d+\s*(?:months?|years?|weeks?))/i)?.[1] ?? base.duration ?? "not stated",
    onset: base.onset ?? "not stated",
    location: base.location,
    patientGoal: base.patientGoal ?? "prepare questions for clinician review",
    age: Number(textBlob.match(/\b(\d{2})[- ]?year[- ]?old\b/i)?.[1]) || base.age,
    followUpQuestions: [
      "What clinician documentation exists for the condition or symptom cluster?",
      "When did symptoms start, and did they begin or worsen after a specific event?",
      "Are current medications stable?",
      "What other diagnoses or conditions could explain the symptoms?",
      "Are multiple study visits, labs, imaging, or blood collection feasible?",
    ],
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function list(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? unique(value.map(String)) : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
