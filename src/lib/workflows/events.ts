import type {
  EventSink,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowPayload,
} from "./types";

export interface EmitEventInput {
  workflowId: string;
  type: WorkflowEventType;
  source?: string;
  payload?: WorkflowPayload;
}

const subscribers = new Set<EventSink>();
const eventLog: WorkflowEvent[] = [];

export function subscribeWorkflowEvents(sink: EventSink): () => void {
  subscribers.add(sink);
  return () => subscribers.delete(sink);
}

export function getWorkflowEvents(workflowId?: string): WorkflowEvent[] {
  return workflowId
    ? eventLog.filter((event) => event.workflowId === workflowId)
    : [...eventLog];
}

export function clearWorkflowEvents(workflowId?: string): void {
  if (!workflowId) {
    eventLog.length = 0;
    return;
  }

  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    if (eventLog[index]?.workflowId === workflowId) {
      eventLog.splice(index, 1);
    }
  }
}

export async function emitEvent(
  input: EmitEventInput,
  sinks?: EventSink | EventSink[],
  now: () => Date = () => new Date(),
): Promise<WorkflowEvent> {
  const event: WorkflowEvent = {
    id: randomId(),
    workflowId: input.workflowId,
    type: input.type,
    at: now().toISOString(),
    source: input.source,
    payload: input.payload,
  };

  eventLog.push(event);

  const targets = [...subscribers, ...normalizeSinks(sinks)];
  const deliveries = await Promise.allSettled(
    targets.map((sink) => sink(event)),
  );
  const deliveryErrors = deliveries
    .filter((delivery) => delivery.status === "rejected")
    .map((delivery) => String(delivery.reason));

  if (deliveryErrors.length > 0) {
    event.deliveryErrors = deliveryErrors;
  }

  return event;
}

function normalizeSinks(sinks?: EventSink | EventSink[]): EventSink[] {
  if (!sinks) {
    return [];
  }

  return Array.isArray(sinks) ? sinks : [sinks];
}

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `evt_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}
