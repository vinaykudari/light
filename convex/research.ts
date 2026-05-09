import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun, touchRun } from "./lib";
import { citation, confidence } from "./validators";

export const upsert = mutation({
  args: {
    id: v.optional(v.id("researchSummaries")),
    runId: v.id("runs"),
    focus: v.string(),
    title: v.string(),
    summary: v.string(),
    findings: v.optional(v.array(v.string())),
    citations: v.optional(v.array(citation)),
    confidence: v.optional(confidence),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    const existing = args.id
      ? await ctx.db.get(args.id)
      : await ctx.db
          .query("researchSummaries")
          .withIndex("by_run_focus", (q) =>
            q.eq("runId", args.runId).eq("focus", args.focus),
          )
          .first();
    if (existing) {
      if (existing.runId !== args.runId) {
        throw new Error("Research summary belongs to a different run");
      }
      await ctx.db.patch(existing._id, {
        focus: args.focus,
        title: args.title,
        summary: args.summary,
        findings: args.findings ?? existing.findings,
        citations: args.citations ?? existing.citations,
        confidence: args.confidence ?? existing.confidence,
        updatedAt: now,
        ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
      });
      await touchRun(ctx, args.runId);
      return existing._id;
    }
    const id = await ctx.db.insert("researchSummaries", {
      runId: args.runId,
      focus: args.focus,
      title: args.title,
      summary: args.summary,
      findings: args.findings ?? [],
      citations: args.citations ?? [],
      confidence: args.confidence ?? "medium",
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
    await touchRun(ctx, args.runId);
    return id;
  },
});

export const listByRun = query({
  args: {
    runId: v.id("runs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    return await ctx.db
      .query("researchSummaries")
      .withIndex("by_run_updatedAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit, 25, 100));
  },
});

export const getByFocus = query({
  args: { runId: v.id("runs"), focus: v.string() },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    return await ctx.db
      .query("researchSummaries")
      .withIndex("by_run_focus", (q) =>
        q.eq("runId", args.runId).eq("focus", args.focus),
      )
      .first();
  },
});
