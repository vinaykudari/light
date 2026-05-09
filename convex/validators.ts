import { v } from "convex/values";

export const runStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("blocked"),
  v.literal("completed"),
  v.literal("failed"),
);

export const agentEventType = v.union(
  v.literal("status"),
  v.literal("thought"),
  v.literal("tool_call"),
  v.literal("tool_result"),
  v.literal("handoff"),
  v.literal("error"),
);

export const agentEventLevel = v.union(
  v.literal("debug"),
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
);

export const trialCardStatus = v.union(
  v.literal("candidate"),
  v.literal("shortlisted"),
  v.literal("eligible"),
  v.literal("ineligible"),
  v.literal("archived"),
);

export const confidence = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const sentiment = v.union(
  v.literal("positive"),
  v.literal("mixed"),
  v.literal("negative"),
  v.literal("neutral"),
);

export const artifactKind = v.union(
  v.literal("brief"),
  v.literal("care_plan"),
  v.literal("patient_message"),
  v.literal("clinician_note"),
  v.literal("visual"),
  v.literal("export"),
);

export const artifactStatus = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("shared"),
  v.literal("archived"),
);

export const artifactFormat = v.union(
  v.literal("markdown"),
  v.literal("html"),
  v.literal("json"),
  v.literal("pdf"),
  v.literal("image"),
);

export const citation = v.object({
  title: v.optional(v.string()),
  source: v.optional(v.string()),
  url: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  excerpt: v.optional(v.string()),
});

export const patientQuote = v.object({
  text: v.string(),
  source: v.optional(v.string()),
  url: v.optional(v.string()),
  capturedAt: v.optional(v.number()),
});
