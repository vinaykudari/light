import { NextRequest } from "next/server";
import { jsonWithCors, optionsWithCors } from "@/lib/api/cors";
import {
  answerClinicalResearchChat,
  getClinicalResearchRunIndex,
  indexClinicalResearchRun,
  type ChatMessage,
} from "@/lib/chat/clinicalResearchChat";
import { getRun } from "@/lib/runs/localRunStore";

export function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) return jsonWithCors({ error: "runId is required" }, { status: 400 });
  const run = getRun(runId);
  if (!run) return jsonWithCors({ error: "Run not found" }, { status: 404 });
  const index = getClinicalResearchRunIndex(run);
  return jsonWithCors({
    runId,
    ready: run.status === "completed",
    totalSources: index.totalSources,
    indexedSources: index.indexedSources,
    indexedCount: index.indexedSources.filter((source) => source.status === "indexed").length,
    failedCount: index.indexedSources.filter((source) => source.status === "failed").length,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    runId?: string;
    question?: string;
    trialId?: string;
    action?: string;
    history?: ChatMessage[];
  };
  if (!body.runId) {
    return jsonWithCors({ error: "runId is required" }, { status: 400 });
  }
  const run = getRun(body.runId);
  if (!run) return jsonWithCors({ error: "Run not found" }, { status: 404 });
  if (run.status !== "completed") {
    return jsonWithCors({ error: "Run must complete before chat is available" }, { status: 409 });
  }
  if (body.action === "index") {
    const indexed = await indexClinicalResearchRun(run);
    return jsonWithCors({
      runId: body.runId,
      totalSources: indexed.totalSources,
      indexedSources: indexed.indexedSources,
      indexedCount: indexed.indexedSources.filter((source) => source.status === "indexed").length,
      failedCount: indexed.indexedSources.filter((source) => source.status === "failed").length,
    });
  }
  if (!body.question?.trim()) {
    return jsonWithCors({ error: "question is required unless action=index" }, { status: 400 });
  }
  const answer = await answerClinicalResearchChat({
    run,
    question: body.question.trim(),
    trialId: body.trialId,
    history: body.history,
  });
  return jsonWithCors(answer);
}

export function OPTIONS() {
  return optionsWithCors();
}
