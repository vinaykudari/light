import type { AgentEvent, AgentName, EventStatus } from "@/lib/types";

export function makeAgentEvent(input: {
  runId: string;
  agent: AgentName;
  status: EventStatus;
  title: string;
  detail: string;
  metadata?: AgentEvent["metadata"];
}): AgentEvent {
  return {
    id: randomId("evt"),
    runId: input.runId,
    agent: input.agent,
    status: input.status,
    title: input.title,
    detail: input.detail,
    timestamp: new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function makeRunId(): string {
  return randomId("run");
}

function randomId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${id}`;
}
