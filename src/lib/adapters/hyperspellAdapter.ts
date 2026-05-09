import { getCapabilityReport } from "@/lib/env";
import { seedClinicMemory } from "@/lib/demo/seedClinicMemory";

export async function loadClinicMemory(): Promise<{
  memories: string[];
  sourceMode: "real" | "mock";
  message?: string;
}> {
  const available = getCapabilityReport().hyperspell;
  if (!available) {
    return {
      memories: seedClinicMemory,
      sourceMode: "mock",
      message: "Hyperspell unavailable, using seeded clinic memory",
    };
  }
  return {
    memories: seedClinicMemory,
    sourceMode: "mock",
    message: "Hyperspell capability present, seeded memory used until workspace is configured",
  };
}
