import { getEnvValue } from "@/lib/env";

export type TensorlakeRunInput<T> = {
  runLocal: () => Promise<T>;
  payload?: Record<string, unknown>;
};

export async function runWithTensorlakeOrLocal<T>(
  input: TensorlakeRunInput<T>,
): Promise<{ result: T; executor: "tensorlake" | "local"; message?: string }> {
  const config = getTensorlakeConfig();
  if (!config) {
    return {
      result: await input.runLocal(),
      executor: "local",
      message: "Tensorlake unavailable, using local async workflow",
    };
  }
  const remote = await submitTensorlake(config, input.payload ?? {});
  const result = await input.runLocal();
  if (!remote.accepted) {
    return {
      result,
      executor: "local",
      message: remote.message,
    };
  }
  return {
    result,
    executor: "tensorlake",
    message: `Tensorlake accepted background request ${remote.requestId ?? "without id"}; local workflow streamed the demo dashboard`,
  };
}

type TensorlakeConfig = {
  token: string;
  url: string;
};

function getTensorlakeConfig(): TensorlakeConfig | undefined {
  const token = getEnvValue(["TENSORLAKE_API_KEY", "TENSORLAKE_TOKEN"]);
  const endpoint = getEnvValue(["TENSORLAKE_ENDPOINT"]);
  const appName = getEnvValue(["TENSORLAKE_APP_NAME", "TENSORLAKE_TRIAL_INTELLIGENCE_APP"]);
  const base = getEnvValue(["TENSORLAKE_BASE_URL", "TENSORLAKE_API_BASE_URL"]) ?? "https://api.tensorlake.ai";
  if (!token) return undefined;
  const url = endpoint ?? (appName ? `${base.replace(/\/$/, "")}/applications/${appName}` : undefined);
  return url ? { token, url } : undefined;
}

async function submitTensorlake(
  config: TensorlakeConfig,
  payload: Record<string, unknown>,
): Promise<{ accepted: boolean; requestId?: string; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    const json = parseJson(text);
    const requestId = stringValue(json.request_id) ?? stringValue(json.id);
    if (!response.ok) {
      return {
        accepted: false,
        message: `Tensorlake API configured but request was not accepted (${response.status}); using local async workflow`,
      };
    }
    return {
      accepted: true,
      requestId,
      message: "Tensorlake accepted background workflow request",
    };
  } catch {
    return {
      accepted: false,
      message: "Tensorlake API configured but unavailable during this run; using local async workflow",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
