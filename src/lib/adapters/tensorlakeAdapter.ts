import { getCapabilityReport } from "@/lib/env";

export type TensorlakeRunInput<T> = {
  runLocal: () => Promise<T>;
};

export async function runWithTensorlakeOrLocal<T>(
  input: TensorlakeRunInput<T>,
): Promise<{ result: T; executor: "tensorlake" | "local"; message?: string }> {
  const available = getCapabilityReport().tensorlake;
  if (!available) {
    return {
      result: await input.runLocal(),
      executor: "local",
      message: "Tensorlake unavailable, using local async workflow",
    };
  }
  return {
    result: await input.runLocal(),
    executor: "local",
    message: "Tensorlake capability present, local workflow used until task queue endpoint is configured",
  };
}
