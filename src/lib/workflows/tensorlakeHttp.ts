import type { TrialIntelligenceInput } from "./types";

export interface TensorlakeHttpOptions {
  apiKey: string;
  appName: string;
  baseUrl: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
}

export interface TensorlakeRequest {
  request_id?: string;
  id?: string;
  output?: unknown;
  result?: unknown;
}

interface TensorlakeStatus {
  outcome?: "success" | "failure" | null;
  failure_reason?: string | null;
  request_error?: string | null;
}

export async function submitTensorlakeRequest(
  options: TensorlakeHttpOptions,
  input: TrialIntelligenceInput,
): Promise<TensorlakeRequest> {
  const response = await options.fetcher(
    `${options.baseUrl}/applications/${options.appName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: options.signal,
    },
  );

  return parseJsonResponse<TensorlakeRequest>(
    response,
    "Tensorlake submit failed",
  );
}

export async function waitForTensorlakeOutput(
  options: TensorlakeHttpOptions,
  requestId: string,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    throwIfAborted(options.signal);
    const status = await getStatus(options, requestId);

    if (status.outcome === "success") {
      return getOutput(options, requestId);
    }

    if (status.outcome === "failure") {
      throw new Error(
        status.failure_reason ?? status.request_error ?? "Tensorlake request failed",
      );
    }

    await delay(pollIntervalMs, options.signal);
  }

  throw new Error(`Tensorlake request timed out after ${timeoutMs}ms`);
}

async function getStatus(
  options: TensorlakeHttpOptions,
  requestId: string,
): Promise<TensorlakeStatus> {
  const response = await options.fetcher(
    `${options.baseUrl}/applications/${options.appName}/requests/${requestId}`,
    {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: options.signal,
    },
  );

  return parseJsonResponse<TensorlakeStatus>(
    response,
    "Tensorlake status failed",
  );
}

async function getOutput(
  options: TensorlakeHttpOptions,
  requestId: string,
): Promise<unknown> {
  const response = await options.fetcher(
    `${options.baseUrl}/applications/${options.appName}/requests/${requestId}/output`,
    {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: options.signal,
    },
  );

  return parseJsonResponse<unknown>(response, "Tensorlake output failed");
}

async function parseJsonResponse<T>(
  response: Response,
  message: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new Error("Workflow aborted"));
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Workflow aborted");
  }
}
