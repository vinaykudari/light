import { fallbackExtraction } from "@/lib/demo";
import type { AdapterSingle, DocumentExtraction } from "./types";
import { resolveEnv } from "./env";
import {
  asArray,
  asRecord,
  asString,
  fetchJson,
  reasonFromError,
} from "./http";
import { cleanOptionalText, cleanText } from "./privacy";

const SOURCE = "Tensorlake";
const DEFAULT_BASE_URL = "https://api.tensorlake.ai";

export interface TensorlakeReadInput {
  fileUrl?: string;
  fileId?: string;
  rawText?: string;
  fileName?: string;
  mimeType?: string;
  pageRange?: string;
  parsingOptions?: Record<string, unknown>;
  enrichmentOptions?: Record<string, unknown>;
}

export interface TensorlakeExtractInput extends TensorlakeReadInput {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

export async function readWithTensorlake(
  input: TensorlakeReadInput,
): Promise<AdapterSingle<DocumentExtraction>> {
  return submitTensorlake("/documents/v2/read", buildReadBody(input));
}

export async function extractWithTensorlake(
  input: TensorlakeExtractInput,
): Promise<AdapterSingle<DocumentExtraction>> {
  return submitTensorlake("/documents/v2/extract", {
    ...buildReadBody(input),
    structured_extraction_options: [
      {
        schema_name: input.schemaName,
        json_schema: input.jsonSchema,
      },
    ],
  });
}

export async function getTensorlakeParseResult(
  parseId: string,
): Promise<AdapterSingle<DocumentExtraction>> {
  const token = await resolveEnv("TENSORLAKE_API_KEY", ["TENSORLAKE_TOKEN"]);
  if (!token) {
    return fallbackTensorlake("Tensorlake API key is not configured");
  }

  try {
    const baseUrl = (await resolveEnv("TENSORLAKE_BASE_URL")) ?? DEFAULT_BASE_URL;
    const data = await fetchJson<unknown>(`${baseUrl}/documents/v2/parse/${parseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {
      source: SOURCE,
      mode: "active",
      fetchedAt: new Date().toISOString(),
      item: mapParseResult(data),
    };
  } catch (error) {
    return fallbackTensorlake(reasonFromError(error));
  }
}

async function submitTensorlake(
  path: string,
  body: Record<string, unknown>,
): Promise<AdapterSingle<DocumentExtraction>> {
  const token = await resolveEnv("TENSORLAKE_API_KEY", ["TENSORLAKE_TOKEN"]);
  if (!token) {
    return fallbackTensorlake("Tensorlake API key is not configured");
  }

  try {
    const baseUrl = (await resolveEnv("TENSORLAKE_BASE_URL")) ?? DEFAULT_BASE_URL;
    const data = await fetchJson<unknown>(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const parseId = asString(asRecord(data).parse_id) ?? asString(asRecord(data).id);

    return {
      source: SOURCE,
      mode: "active",
      fetchedAt: new Date().toISOString(),
      item: {
        id: parseId ?? "tensorlake-submission",
        parseId,
        status: "pending",
        title: cleanOptionalText(body.file_name, 160),
        source: SOURCE,
      },
    };
  } catch (error) {
    return fallbackTensorlake(reasonFromError(error));
  }
}

function buildReadBody(input: TensorlakeReadInput): Record<string, unknown> {
  return {
    file_url: input.fileUrl,
    file_id: input.fileId,
    raw_text: input.rawText,
    file_name: input.fileName,
    mime_type: input.mimeType,
    page_range: input.pageRange,
    parsing_options: input.parsingOptions ?? { chunking_strategy: "page" },
    enrichment_options: input.enrichmentOptions,
  };
}

function mapParseResult(data: unknown): DocumentExtraction {
  const record = asRecord(data);
  const parseId = asString(record.parse_id);
  const chunks = asArray(record.chunks)
    .map((chunk) => cleanOptionalText(asRecord(chunk).content ?? chunk, 1200))
    .filter((chunk): chunk is string => Boolean(chunk));

  return {
    id: parseId ?? "tensorlake-result",
    parseId,
    status: cleanText(record.status ?? "unknown", 80),
    source: SOURCE,
    chunks,
    content: chunks.join("\n\n") || undefined,
    structured: record.structured_data ?? undefined,
  };
}

function fallbackTensorlake(reason: string): AdapterSingle<DocumentExtraction> {
  return {
    source: SOURCE,
    mode: "fallback",
    reason,
    fetchedAt: new Date().toISOString(),
    item: fallbackExtraction(),
  };
}
