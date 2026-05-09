import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun, touchRun } from "./lib";
import { agentEventLevel, agentEventType, runStatus } from "./validators";

export const append = mutation({
  args: {
    runId: v.id("runs"),
    type: agentEventType,
    actor: v.string(),
    message: v.string(),
    level: v.optional(agentEventLevel),
    sequence: v.optional(v.number()),
    payload: v.optional(v.any()),
    runStatus: v.optional(runStatus),
    currentStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    const eventId = await ctx.db.insert("agentEvents", {
      runId: args.runId,
      type: args.type,
      level: args.level ?? "info",
      actor: args.actor,
      message: args.message,
      createdAt: now,
      ...(args.sequence !== undefined ? { sequence: args.sequence } : {}),
      ...(args.payload !== undefined ? { payload: args.payload } : {}),
    });
    await touchRun(ctx, args.runId, {
      ...(args.runStatus !== undefined ? { status: args.runStatus } : {}),
      ...(args.currentStep !== undefined ? { currentStep: args.currentStep } : {}),
    });
    return eventId;
  },
});

export const listByRun = query({
  args: {
    runId: v.id("runs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_run_createdAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit, 100, 300));
    return events.reverse();
  },
});

export const latestByType = query({
  args: {
    runId: v.id("runs"),
    type: agentEventType,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    return await ctx.db
      .query("agentEvents")
      .withIndex("by_run_type", (q) =>
        q.eq("runId", args.runId).eq("type", args.type),
      )
      .order("desc")
      .take(clampLimit(args.limit, 10, 50));
  },
});
