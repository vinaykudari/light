/* eslint-disable */
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as artifacts from "../artifacts.js";
import type * as events from "../events.js";
import type * as research from "../research.js";
import type * as runs from "../runs.js";
import type * as trials from "../trials.js";
import type * as voice from "../voice.js";

declare const fullApi: ApiFromModules<{
  artifacts: typeof artifacts;
  events: typeof events;
  research: typeof research;
  runs: typeof runs;
  trials: typeof trials;
  voice: typeof voice;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
