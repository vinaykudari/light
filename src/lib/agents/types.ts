import type { AgentEvent, AgentName, EventStatus, PatientProfile } from "@/lib/types";

export type AgentEmit = (
  agent: AgentName,
  status: EventStatus,
  title: string,
  detail: string,
  metadata?: AgentEvent["metadata"],
) => Promise<void>;

export type AgentContext = {
  runId: string;
  patient: PatientProfile;
  emit: AgentEmit;
};
