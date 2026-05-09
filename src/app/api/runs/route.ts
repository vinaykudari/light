import { NextRequest, NextResponse } from "next/server";
import { getRun, listRuns, startRun } from "@/lib/runs/localRunStore";
import type { PatientProfileInput } from "@/lib/types";

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
  const body = (await request.json().catch(() => ({}))) as { patient?: PatientProfileInput };
  const run = startRun(body.patient ?? {});
  return NextResponse.json(run, { status: 202 });
}
