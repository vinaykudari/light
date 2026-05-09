import { NextResponse } from "next/server";
import { capabilityMode, getCapabilityReport } from "@/lib/env";

export function GET() {
  const capabilities = getCapabilityReport();
  return NextResponse.json({
    ok: true,
    app: "Light",
    sourceMode: capabilityMode(capabilities),
    capabilities,
  });
}
