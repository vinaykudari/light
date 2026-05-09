import { NextRequest, NextResponse } from "next/server";
import { getRun, listRuns, runNow, startRun } from "@/lib/runs/localRunStore";
import type { ConversationTurn, PatientProfileInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("id");
  if (runId) {
    const run = getRun(runId);
    return run
      ? NextResponse.json(run)
      : NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ runs: listRuns() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    patient?: PatientProfileInput;
    conversationTranscript?: ConversationTurn[];
  };
  if (process.env.VERCEL) {
    const run = await runNow(body.patient ?? {}, body.conversationTranscript);
    return NextResponse.json(run);
  }
  const run = startRun(body.patient ?? {}, body.conversationTranscript);
  return NextResponse.json(run, { status: 202 });
}
