import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type RunPatch = Omit<Partial<Doc<"runs">>, "_id" | "_creationTime">;

export function clampLimit(limit: number | undefined, fallback = 50, max = 100) {
  return Math.min(max, Math.max(1, limit ?? fallback));
}

export async function ensureRun(
  ctx: QueryCtx | MutationCtx,
  runId: Id<"runs">,
) {
  const run = await ctx.db.get(runId);
  if (!run) {
    throw new Error("Run not found");
  }
  return run;
}

export async function touchRun(
  ctx: MutationCtx,
  runId: Id<"runs">,
  patch: RunPatch = {},
) {
  await ctx.db.patch(runId, { ...patch, updatedAt: Date.now() });
}
