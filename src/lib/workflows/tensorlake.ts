import {
  submitTensorlakeRequest,
  waitForTensorlakeOutput,
} from "./tensorlakeHttp";
import type {
  TrialIntelligenceAdapter,
  TrialIntelligenceResult,
} from "./types";

export interface TensorlakeConfig {
  apiKey?: string;
  appName?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export function createTensorlakeAdapter(
  config: TensorlakeConfig = {},
): TrialIntelligenceAdapter | undefined {
  const env = readEnv();
  const apiKey = config.apiKey ?? env.TENSORLAKE_API_KEY;
  const appName =
    config.appName ??
    env.TENSORLAKE_TRIAL_INTELLIGENCE_APP ??
    env.TENSORLAKE_APP_NAME;
  const fetcher = config.fetcher ?? globalThis.fetch?.bind(globalThis);

  if (!apiKey || !appName || !fetcher) {
    return undefined;
  }

  const baseUrl = (
    config.baseUrl ??
    env.TENSORLAKE_API_BASE_URL ??
    "https://api.tensorlake.ai"
  ).replace(/\/$/, "");
  const pollIntervalMs = config.pollIntervalMs ?? 1_000;
  const timeoutMs = config.timeoutMs ?? 120_000;

  return {
    name: "tensorlake",
    available: () => true,
    runTrialIntelligence: async (input, context) => {
      const httpOptions = {
        apiKey,
        appName,
        baseUrl,
        fetcher,
        signal: context.signal,
      };
      const request = await submitTensorlakeRequest(httpOptions, input);
      const requestId = request.request_id ?? request.id;

      if (!requestId) {
        return normalizeOutput(
          request.output ?? request.result ?? request,
          context.workflowId,
        );
      }

      await context.emit("tensorlake.request.created", { requestId, appName });
      const output = await waitForTensorlakeOutput(
        httpOptions,
        requestId,
        pollIntervalMs,
        timeoutMs,
      );
      await context.emit("tensorlake.request.completed", { requestId, appName });

      return normalizeOutput(output, context.workflowId);
    },
  };
}

function normalizeOutput(
  output: unknown,
  workflowId: string,
): TrialIntelligenceResult {
  if (isResult(output)) {
    return {
      ...output,
      workflowId: output.workflowId ?? workflowId,
      executor: "tensorlake",
    };
  }

  return {
    workflowId,
    status: "completed",
    summary:
      typeof output === "string"
        ? output
        : "Tensorlake trial intelligence workflow completed.",
    findings: [],
    recommendations: [],
    risks: [],
    events: [],
    executor: "tensorlake",
    durationMs: 0,
    rawOutput: output,
  };
}

function isResult(output: unknown): output is TrialIntelligenceResult {
  return (
    typeof output === "object" &&
    output !== null &&
    "summary" in output &&
    "findings" in output
  );
}

function readEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
