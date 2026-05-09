import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun, touchRun } from "./lib";
import { artifactFormat, artifactKind, artifactStatus } from "./validators";

export const upsert = mutation({
  args: {
    id: v.optional(v.id("generatedArtifacts")),
    runId: v.id("runs"),
    key: v.optional(v.string()),
    kind: artifactKind,
    status: v.optional(artifactStatus),
    format: artifactFormat,
    title: v.string(),
    content: v.optional(v.string()),
    data: v.optional(v.any()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    version: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    const existing = args.id
      ? await ctx.db.get(args.id)
      : args.key
        ? await ctx.db
            .query("generatedArtifacts")
            .withIndex("by_run_key", (q) =>
              q.eq("runId", args.runId).eq("key", args.key),
            )
            .first()
        : null;
    if (existing) {
      if (existing.runId !== args.runId) {
        throw new Error("Generated artifact belongs to a different run");
      }
      await ctx.db.patch(existing._id, {
        kind: args.kind,
        status: args.status ?? existing.status,
        format: args.format,
        title: args.title,
        version: args.version ?? existing.version + 1,
        updatedAt: now,
        ...(args.key !== undefined ? { key: args.key } : {}),
        ...(args.content !== undefined ? { content: args.content } : {}),
        ...(args.data !== undefined ? { data: args.data } : {}),
        ...(args.url !== undefined ? { url: args.url } : {}),
        ...(args.storageId !== undefined ? { storageId: args.storageId } : {}),
        ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
      });
      await touchRun(ctx, args.runId);
      return existing._id;
    }
    const id = await ctx.db.insert("generatedArtifacts", {
      runId: args.runId,
      kind: args.kind,
      status: args.status ?? "draft",
      format: args.format,
      title: args.title,
      version: args.version ?? 1,
      createdAt: now,
      updatedAt: now,
      ...(args.key !== undefined ? { key: args.key } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(args.data !== undefined ? { data: args.data } : {}),
      ...(args.url !== undefined ? { url: args.url } : {}),
      ...(args.storageId !== undefined ? { storageId: args.storageId } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
    await touchRun(ctx, args.runId);
    return id;
  },
});

export const listByRun = query({
  args: {
    runId: v.id("runs"),
    kind: v.optional(artifactKind),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const kind = args.kind;
    if (kind !== undefined) {
      return await ctx.db
        .query("generatedArtifacts")
        .withIndex("by_run_kind", (q) =>
          q.eq("runId", args.runId).eq("kind", kind),
        )
        .order("desc")
        .take(clampLimit(args.limit, 25, 100));
    }
    return await ctx.db
      .query("generatedArtifacts")
      .withIndex("by_run_updatedAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit, 25, 100));
  },
});

export const getByKey = query({
  args: { runId: v.id("runs"), key: v.string() },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    return await ctx.db
      .query("generatedArtifacts")
      .withIndex("by_run_key", (q) =>
        q.eq("runId", args.runId).eq("key", args.key),
      )
      .first();
  },
});
