import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentEventLevel,
  agentEventType,
  artifactFormat,
  artifactKind,
  artifactStatus,
  citation,
  confidence,
  patientQuote,
  runStatus,
  sentiment,
  trialCardStatus,
} from "./validators";

export default defineSchema({
  runs: defineTable({
    title: v.string(),
    status: runStatus,
    objective: v.optional(v.string()),
    patientContext: v.optional(v.string()),
    currentStep: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_updatedAt", ["updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  agentEvents: defineTable({
    runId: v.id("runs"),
    type: agentEventType,
    level: agentEventLevel,
    actor: v.string(),
    message: v.string(),
    sequence: v.optional(v.number()),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_run_createdAt", ["runId", "createdAt"])
    .index("by_run_type", ["runId", "type"]),

  trialCards: defineTable({
    runId: v.id("runs"),
    externalId: v.optional(v.string()),
    title: v.string(),
    sponsor: v.optional(v.string()),
    phase: v.optional(v.string()),
    condition: v.optional(v.string()),
    locationSummary: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    status: trialCardStatus,
    matchScore: v.optional(v.number()),
    rationale: v.optional(v.string()),
    risks: v.optional(v.array(v.string())),
    tags: v.array(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_updatedAt", ["runId", "updatedAt"])
    .index("by_run_externalId", ["runId", "externalId"])
    .index("by_run_status", ["runId", "status"]),

  researchSummaries: defineTable({
    runId: v.id("runs"),
    focus: v.string(),
    title: v.string(),
    summary: v.string(),
    findings: v.array(v.string()),
    citations: v.array(citation),
    confidence,
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_updatedAt", ["runId", "updatedAt"])
    .index("by_run_focus", ["runId", "focus"]),

  patientVoiceThemes: defineTable({
    runId: v.id("runs"),
    theme: v.string(),
    summary: v.string(),
    sentiment,
    prevalence: v.optional(v.number()),
    quotes: v.array(patientQuote),
    sourceCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_updatedAt", ["runId", "updatedAt"])
    .index("by_run_theme", ["runId", "theme"]),

  generatedArtifacts: defineTable({
    runId: v.id("runs"),
    key: v.optional(v.string()),
    kind: artifactKind,
    status: artifactStatus,
    format: artifactFormat,
    title: v.string(),
    content: v.optional(v.string()),
    data: v.optional(v.any()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    version: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_updatedAt", ["runId", "updatedAt"])
    .index("by_run_key", ["runId", "key"])
    .index("by_run_kind", ["runId", "kind"]),
});
