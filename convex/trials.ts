import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun, touchRun } from "./lib";
import { trialCardStatus } from "./validators";

const trialCardArgs = {
  externalId: v.optional(v.string()),
  title: v.string(),
  sponsor: v.optional(v.string()),
  phase: v.optional(v.string()),
  condition: v.optional(v.string()),
  locationSummary: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  status: v.optional(trialCardStatus),
  matchScore: v.optional(v.number()),
  rationale: v.optional(v.string()),
  risks: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  metadata: v.optional(v.any()),
};

export const upsert = mutation({
  args: {
    id: v.optional(v.id("trialCards")),
    runId: v.id("runs"),
    ...trialCardArgs,
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    const existing = args.id
      ? await ctx.db.get(args.id)
      : args.externalId
        ? await ctx.db
            .query("trialCards")
            .withIndex("by_run_externalId", (q) =>
              q.eq("runId", args.runId).eq("externalId", args.externalId),
            )
            .first()
        : null;
    if (existing) {
      if (existing.runId !== args.runId) {
        throw new Error("Trial card belongs to a different run");
      }
      await ctx.db.patch(existing._id, {
        title: args.title,
        updatedAt: now,
        status: args.status ?? existing.status,
        tags: args.tags ?? existing.tags,
        ...(args.externalId !== undefined ? { externalId: args.externalId } : {}),
        ...(args.sponsor !== undefined ? { sponsor: args.sponsor } : {}),
        ...(args.phase !== undefined ? { phase: args.phase } : {}),
        ...(args.condition !== undefined ? { condition: args.condition } : {}),
        ...(args.locationSummary !== undefined
          ? { locationSummary: args.locationSummary }
          : {}),
        ...(args.sourceUrl !== undefined ? { sourceUrl: args.sourceUrl } : {}),
        ...(args.matchScore !== undefined ? { matchScore: args.matchScore } : {}),
        ...(args.rationale !== undefined ? { rationale: args.rationale } : {}),
        ...(args.risks !== undefined ? { risks: args.risks } : {}),
        ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
      });
      await touchRun(ctx, args.runId);
      return existing._id;
    }
    const id = await ctx.db.insert("trialCards", {
      runId: args.runId,
      title: args.title,
      status: args.status ?? "candidate",
      tags: args.tags ?? [],
      createdAt: now,
      updatedAt: now,
      ...(args.externalId !== undefined ? { externalId: args.externalId } : {}),
      ...(args.sponsor !== undefined ? { sponsor: args.sponsor } : {}),
      ...(args.phase !== undefined ? { phase: args.phase } : {}),
      ...(args.condition !== undefined ? { condition: args.condition } : {}),
      ...(args.locationSummary !== undefined
        ? { locationSummary: args.locationSummary }
        : {}),
      ...(args.sourceUrl !== undefined ? { sourceUrl: args.sourceUrl } : {}),
      ...(args.matchScore !== undefined ? { matchScore: args.matchScore } : {}),
      ...(args.rationale !== undefined ? { rationale: args.rationale } : {}),
      ...(args.risks !== undefined ? { risks: args.risks } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
    await touchRun(ctx, args.runId);
    return id;
  },
});

export const listByRun = query({
  args: {
    runId: v.id("runs"),
    status: v.optional(trialCardStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const limit = clampLimit(args.limit, 50, 200);
    const status = args.status;
    if (status !== undefined) {
      return await ctx.db
        .query("trialCards")
        .withIndex("by_run_status", (q) =>
          q.eq("runId", args.runId).eq("status", status),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("trialCards")
      .withIndex("by_run_updatedAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(limit);
  },
});

export const remove = mutation({
  args: { id: v.id("trialCards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.id);
    if (!card) return null;
    await ctx.db.delete(args.id);
    await touchRun(ctx, card.runId);
    return args.id;
  },
});
