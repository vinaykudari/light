import { NextRequest } from "next/server";
import { jsonWithCors, optionsWithCors } from "@/lib/api/cors";
import { answerClinicalResearchChat, type ChatMessage } from "@/lib/chat/clinicalResearchChat";
import { getRun } from "@/lib/runs/localRunStore";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    runId?: string;
    question?: string;
    history?: ChatMessage[];
  };
  if (!body.runId || !body.question?.trim()) {
    return jsonWithCors({ error: "runId and question are required" }, { status: 400 });
  }
  const run = getRun(body.runId);
  if (!run) return jsonWithCors({ error: "Run not found" }, { status: 404 });
  if (run.status !== "completed") {
    return jsonWithCors({ error: "Run must complete before chat is available" }, { status: 409 });
  }
  const answer = await answerClinicalResearchChat({
    run,
    question: body.question.trim(),
    history: body.history,
  });
  return jsonWithCors(answer);
}

export function OPTIONS() {
  return optionsWithCors();
}
