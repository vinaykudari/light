import { hasLlmProvider } from "@/lib/adapters/llmAdapter";
import { extractConversationWithLlm } from "@/lib/llm/conversationExtraction";
import type { ConversationSummary, ConversationTurn, PatientProfile } from "@/lib/types";
import type { AgentContext } from "./types";

export async function runConversationAgent(
  context: AgentContext,
  transcript?: ConversationTurn[],
): Promise<{ patient: PatientProfile; summary?: ConversationSummary }> {
  if (!transcript?.length) return { patient: context.patient };
  if (!hasLlmProvider()) {
    throw new Error("LLM provider is required for agentic conversation extraction");
  }
  await context.emit("conversation", "running", "Doctor voice agent listening", "Transcript is being parsed with the LLM for symptom timing, location, goals, and missing pre-screening details.");
  const extracted = await extractProfile(transcript, context.patient);
  const patient = {
    ...context.patient,
    ...extracted.patient,
    id: context.patient.id || "conversation-demo",
  };
  const summary: ConversationSummary = {
    transcript,
    extractedProfile: extracted.summary,
    followUpQuestions: extracted.followUpQuestions,
  };
  await context.emit("conversation", "completed", "Conversation Agent extracted symptom cluster", `Light connected ${extracted.summary.symptoms.join(", ")} with ${extracted.summary.possibleConditionContext} and ${extracted.summary.location}.`);
  return { patient, summary };
}

async function extractProfile(transcript: ConversationTurn[], base: PatientProfile) {
  const { extraction } = await extractConversationWithLlm(transcript, base);
  return {
    patient: {
      age: extraction.age ?? base.age,
      diagnosis: extraction.possibleConditionContext,
      possibleConditionContext: extraction.possibleConditionContext,
      symptoms: extraction.symptoms,
      duration: extraction.duration,
      onset: extraction.onset,
      patientGoal: extraction.patientGoal,
      biomarkers: unique([extraction.possibleConditionContext, ...extraction.symptoms]),
      priorTherapies: base.priorTherapies.length ? base.priorTherapies : ["none documented in demo conversation"],
      location: extraction.location,
      maxTravelMiles: base.maxTravelMiles || 50,
      preferences: unique([...(base.preferences ?? []), "wants doctor-reviewed research study options", "wants to understand symptom measurement"]),
      missingDataHints: unique([...extraction.followUpQuestions.map(questionToMissingData), ...(base.missingDataHints ?? [])]),
    },
    summary: {
      possibleConditionContext: extraction.possibleConditionContext,
      symptoms: extraction.symptoms,
      duration: extraction.duration,
      onset: extraction.onset,
      location: extraction.location,
      patientGoal: extraction.patientGoal,
    },
    followUpQuestions: extraction.followUpQuestions,
  };
}

function questionToMissingData(question: string): string {
  return question.replace(/\?$/, "").replace(/^Are you /, "whether patient is ").replace(/^Was /, "").replace(/^Did /, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
