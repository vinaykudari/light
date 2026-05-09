import { emitEvent } from "./events";
import { runLocalWorkflow } from "./localExecution";
import { createTensorlakeAdapter } from "./tensorlake";
import type {
  EventSink,
  RunTrialIntelligenceOptions,
  TrialIntelligenceAdapter,
  TrialIntelligenceInput,
  TrialIntelligenceResult,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowPayload,
} from "./types";

export async function runTrialIntelligence(
  input: TrialIntelligenceInput,
  options: RunTrialIntelligenceOptions = {},
): Promise<TrialIntelligenceResult> {
  const workflowId = options.workflowId ?? makeWorkflowId(input);
  const startedAt = Date.now();
  const events: WorkflowEvent[] = [];
  const sinks = buildSinks(options.emit, events, options.collectEvents !== false);
  const emit = (
    type: WorkflowEventType,
    payload?: WorkflowPayload,
  ): Promise<WorkflowEvent> =>
    emitEvent({ workflowId, type, payload, source: "trial-intelligence" }, sinks, options.now);

  await emit("workflow.started", {
    trialId: input.trialId,
    executor: options.useTensorlake === false ? "local" : "auto",
  });

  const adapter = await resolveAdapter(options);
  if (adapter) {
    try {
      await emit("workflow.delegated", { executor: adapter.name });
      const result = await adapter.runTrialIntelligence(input, {
        workflowId,
        emit,
        signal: options.signal,
      });
      const finalResult = finishResult(result, {
        workflowId,
        executor: adapter.name,
        events,
        startedAt,
      });
      await emit("workflow.completed", { executor: adapter.name });
      return { ...finalResult, events };
    } catch (error) {
      if (options.fallbackToLocal === false) {
        await emit("workflow.failed", { error: errorMessage(error) });
        throw error;
      }

      await emit("workflow.fallback", {
        executor: adapter.name,
        reason: errorMessage(error),
      });
    }
  }

  return runLocalWorkflow({
    input,
    options,
    workflowId,
    startedAt,
    events,
    emit,
  });
}

async function resolveAdapter(
  options: RunTrialIntelligenceOptions,
): Promise<TrialIntelligenceAdapter | undefined> {
  if (options.useTensorlake === false) {
    return undefined;
  }

  const adapter = options.adapter ?? createTensorlakeAdapter(options.tensorlake);
  if (!adapter) {
    return undefined;
  }

  try {
    const available = await adapter.available?.();
    return available === false ? undefined : adapter;
  } catch {
    return undefined;
  }
}

function buildSinks(
  sink: EventSink | EventSink[] | undefined,
  events: WorkflowEvent[],
  collectEvents: boolean,
): EventSink[] {
  const sinks = Array.isArray(sink) ? [...sink] : sink ? [sink] : [];
  if (collectEvents) {
    sinks.push((event) => {
      events.push(event);
    });
  }
  return sinks;
}

function finishResult(
  result: TrialIntelligenceResult,
  args: {
    workflowId: string;
    executor: string;
    events: WorkflowEvent[];
    startedAt: number;
  },
): TrialIntelligenceResult {
  return {
    ...result,
    workflowId: args.workflowId,
    executor: args.executor,
    events: args.events,
    durationMs: Date.now() - args.startedAt,
  };
}

function makeWorkflowId(input: TrialIntelligenceInput): string {
  const stableId = input.trialId ?? input.trialTitle ?? input.condition;
  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return stableId ? `trial_${slugify(String(stableId))}_${suffix}` : `trial_${suffix}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
