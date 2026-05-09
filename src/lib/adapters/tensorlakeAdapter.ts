import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { getEnvValue } from "@/lib/env";

const execFileAsync = promisify(execFile);

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
  const remote = await runTensorlakeSandbox(config, input.payload ?? {});
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
    message: `Tensorlake Sandbox executed live orchestration preflight${remote.summary ? `: ${remote.summary}` : ""}; local workflow streamed the dashboard`,
  };
}

type TensorlakeConfig = {
  token: string;
  python: string;
};

function getTensorlakeConfig(): TensorlakeConfig | undefined {
  const token = getEnvValue(["TENSORLAKE_API_KEY", "TENSORLAKE_TOKEN"]);
  if (!token) return undefined;
  return { token, python: getTensorlakePython() };
}

async function runTensorlakeSandbox(
  config: TensorlakeConfig,
  payload: Record<string, unknown>,
): Promise<{ accepted: boolean; message: string; summary?: string }> {
  try {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const { stdout } = await execFileAsync(config.python, ["-c", sandboxLauncher(), encoded], {
      env: {
        ...process.env,
        TENSORLAKE_API_KEY: config.token,
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    const json = parseJson(stdout);
    if (json.ok !== true) {
      return {
        accepted: false,
        message: `Tensorlake Sandbox did not complete; using local async workflow`,
      };
    }
    return {
      accepted: true,
      message: "Tensorlake Sandbox completed",
      summary: stringValue(json.summary),
    };
  } catch (error) {
    return {
      accepted: false,
      message: `Tensorlake Sandbox unavailable during this run (${safeError(error)}); using local async workflow`,
    };
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

function safeError(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown error";
  const record = error as Record<string, unknown>;
  const detail = typeof record.stderr === "string" && record.stderr.trim()
    ? record.stderr
    : typeof record.message === "string" ? record.message : "unknown error";
  const message = detail.split("\n").slice(-3).join(" ");
  return message.replace(/tl_apiKey_[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 180);
}

function getTensorlakePython(): string {
  const configured = getEnvValue(["TENSORLAKE_PYTHON"]);
  if (configured) return configured;
  const local = "/home/openclaw/.openclaw/workspace/.venv-tensorlake/bin/python";
  return existsSync(local) ? local : "python3";
}

function sandboxLauncher(): string {
  return String.raw`
import base64
import json
import os
import re
import sys
from tensorlake.sandbox import Sandbox

payload = json.loads(base64.urlsafe_b64decode(sys.argv[1] + "==="))
patient = payload.get("patient") or {}
condition = patient.get("possibleConditionContext") or patient.get("diagnosis") or "clinical trial"
symptom_items = patient.get("symptoms") or patient.get("biomarkers") or []
symptoms = " ".join([str(item) for item in symptom_items if item])

def add_query(values, value):
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if text and text.lower() not in [item.lower() for item in values]:
        values.append(text)

queries = []
add_query(queries, condition)
add_query(queries, " ".join([condition, " ".join(symptom_items[:2])]))
add_query(queries, " ".join(symptom_items[:4]))
tokens = re.findall(r"[A-Za-z0-9-]{3,}", " ".join([condition, symptoms]))
add_query(queries, " ".join(tokens[:8]))
if not queries:
    queries = ["clinical trial"]

inner = r'''
import json
import sys
import urllib.parse
import urllib.request

queries = json.loads(sys.argv[1])

def read_json(url):
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return {"_error": type(exc).__name__}

studies = []
seen_nct = set()
for query in queries:
    for field in ["query.cond", "query.term"]:
        ct_params = urllib.parse.urlencode({
            field: query,
            "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING",
            "pageSize": "5",
            "format": "json",
        })
        ct = read_json("https://clinicaltrials.gov/api/v2/studies?" + ct_params)
        for study in ct.get("studies") or []:
            nct = (((study or {}).get("protocolSection") or {}).get("identificationModule") or {}).get("nctId")
            if nct and nct not in seen_nct:
                seen_nct.add(nct)
                studies.append(study)
        if len(studies) >= 5:
            break
    if len(studies) >= 5:
        break

ids = []
seen_ids = set()
for query in queries:
    pm_params = urllib.parse.urlencode({
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": "5",
        "sort": "relevance",
    })
    pm = read_json("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + pm_params)
    for pmid in ((pm.get("esearchresult") or {}).get("idlist") or []):
        if pmid not in seen_ids:
            seen_ids.add(pmid)
            ids.append(pmid)
    if len(ids) >= 5:
        break
print(json.dumps({
    "clinicalTrialsCount": len(studies),
    "firstNctId": (((studies[0] or {}).get("protocolSection") or {}).get("identificationModule") or {}).get("nctId") if studies else None,
    "pubMedCount": len(ids),
    "firstPubMedId": ids[0] if ids else None,
}))
'''

sandbox = Sandbox.create(
    cpus=2.0,
    memory_mb=2048,
    timeout_secs=600,
    allow_internet_access=True,
    api_key=os.environ.get("TENSORLAKE_API_KEY"),
)
result = sandbox.run("python", ["-c", inner, json.dumps(queries[:4])], timeout=90)
if getattr(result, "exit_code", 0) != 0:
    raise RuntimeError(result.stderr or "sandbox command failed")
probe = json.loads(result.stdout or "{}")
summary = "ClinicalTrials.gov {ct} records, PubMed {pm} records".format(
    ct=probe.get("clinicalTrialsCount", 0),
    pm=probe.get("pubMedCount", 0),
)
print(json.dumps({"ok": True, "summary": summary, "probe": probe}))
`;
}
