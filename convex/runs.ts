import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun } from "./lib";
import { runStatus } from "./validators";

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    objective: v.optional(v.string()),
    patientContext: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("runs", {
      title: args.title ?? "Untitled run",
      status: "queued",
      createdAt: now,
      updatedAt: now,
      ...(args.objective !== undefined ? { objective: args.objective } : {}),
      ...(args.patientContext !== undefined
        ? { patientContext: args.patientContext }
        : {}),
      ...(args.createdBy !== undefined ? { createdBy: args.createdBy } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

export const get = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const list = query({
  args: {
    status: v.optional(runStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const status = args.status;
    if (status !== undefined) {
      return await ctx.db
        .query("runs")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("runs").withIndex("by_updatedAt").order("desc").take(limit);
  },
});

export const update = mutation({
  args: {
    runId: v.id("runs"),
    title: v.optional(v.string()),
    status: v.optional(runStatus),
    objective: v.optional(v.string()),
    patientContext: v.optional(v.string()),
    currentStep: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      updatedAt: now,
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.objective !== undefined ? { objective: args.objective } : {}),
      ...(args.patientContext !== undefined
        ? { patientContext: args.patientContext }
        : {}),
      ...(args.currentStep !== undefined ? { currentStep: args.currentStep } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
      ...(args.status === "running" ? { startedAt: now } : {}),
      ...(args.status === "completed" || args.status === "failed"
        ? { completedAt: now }
        : {}),
    });
    return args.runId;
  },
});
