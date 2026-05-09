import { NextRequest } from "next/server";
import { jsonWithCors, optionsWithCors } from "@/lib/api/cors";
import { getRun, listRuns, runNow, startRun } from "@/lib/runs/localRunStore";
import type { ConversationTurn, PatientProfileInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("id");
  if (runId) {
    const run = getRun(runId);
    return run
      ? jsonWithCors(run)
      : jsonWithCors({ error: "Run not found" }, { status: 404 });
  }
  return jsonWithCors({ runs: listRuns() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    patient?: PatientProfileInput;
    conversationTranscript?: ConversationTurn[];
  };
  if (process.env.VERCEL) {
    const run = await runNow(body.patient ?? {}, body.conversationTranscript);
    return jsonWithCors(run);
  }
  const run = startRun(body.patient ?? {}, body.conversationTranscript);
  return jsonWithCors(run, { status: 202 });
}

export function OPTIONS() {
  return optionsWithCors();
}
