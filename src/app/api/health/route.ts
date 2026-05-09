import { jsonWithCors, optionsWithCors } from "@/lib/api/cors";
import { capabilityMode, getCapabilityReport } from "@/lib/env";

export function GET() {
  const capabilities = getCapabilityReport();
  return jsonWithCors({
    ok: true,
    app: "Light",
    sourceMode: capabilityMode(capabilities),
    capabilities,
  });
}

export function OPTIONS() {
  return optionsWithCors();
}
