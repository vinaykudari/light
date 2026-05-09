import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clampLimit, ensureRun, touchRun } from "./lib";
import { patientQuote, sentiment } from "./validators";

export const upsertTheme = mutation({
  args: {
    id: v.optional(v.id("patientVoiceThemes")),
    runId: v.id("runs"),
    theme: v.string(),
    summary: v.string(),
    sentiment: v.optional(sentiment),
    prevalence: v.optional(v.number()),
    quotes: v.optional(v.array(patientQuote)),
    sourceCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ensureRun(ctx, args.runId);
    const now = Date.now();
    const existing = args.id
      ? await ctx.db.get(args.id)
      : await ctx.db
          .query("patientVoiceThemes")
          .withIndex("by_run_theme", (q) =>
            q.eq("runId", args.runId).eq("theme", args.theme),
          )
          .first();
    if (existing) {
      if (existing.runId !== args.runId) {
        throw new Error("Patient voice theme belongs to a different run");
      }
      await ctx.db.patch(existing._id, {
        theme: args.theme,
        summary: args.summary,
        sentiment: args.sentiment ?? existing.sentiment,
        quotes: args.quotes ?? existing.quotes,
        updatedAt: now,
        ...(args.prevalence !== undefined ? { prevalence: args.prevalence } : {}),
        ...(args.sourceCount !== undefined ? { sourceCount: args.sourceCount } : {}),
        ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
      });
      await touchRun(ctx, args.runId);
      return existing._id;
    }
    const id = await ctx.db.insert("patientVoiceThemes", {
      runId: args.runId,
      theme: args.theme,
      summary: args.summary,
      sentiment: args.sentiment ?? "neutral",
      quotes: args.quotes ?? [],
      createdAt: now,
      updatedAt: now,
      ...(args.prevalence !== undefined ? { prevalence: args.prevalence } : {}),
      ...(args.sourceCount !== undefined ? { sourceCount: args.sourceCount } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
    await touchRun(ctx, args.runId);
    return id;
  },
});

export const addQuote = mutation({
  args: {
    themeId: v.id("patientVoiceThemes"),
    quote: patientQuote,
  },
  handler: async (ctx, args) => {
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Patient voice theme not found");
    await ctx.db.patch(args.themeId, {
      quotes: [...theme.quotes, args.quote],
      updatedAt: Date.now(),
    });
    await touchRun(ctx, theme.runId);
    return args.themeId;
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
      .query("patientVoiceThemes")
      .withIndex("by_run_updatedAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit, 25, 100));
  },
});
