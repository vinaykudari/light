import { indexNiaSources, type NiaIndexedSource, type NiaIndexSource } from "@/lib/adapters/niaIndexAdapter";
import type { TrialIntelligenceState } from "@/lib/types";

const indexedRuns = new Map<string, NiaIndexedSource[]>();

export async function ensureRunIndexedOnNia(run: TrialIntelligenceState): Promise<NiaIndexedSource[]> {
  const cached = indexedRuns.get(run.runId);
  if (cached?.length) return cached;
  const indexed = await indexNiaSources(collectRunSources(run));
  indexedRuns.set(run.runId, indexed);
  return indexed;
}

export function getRunNiaIndex(runId: string): NiaIndexedSource[] {
  return indexedRuns.get(runId) ?? [];
}

export function collectRunSources(run: TrialIntelligenceState): NiaIndexSource[] {
  const trialSources = run.trials.flatMap((trial): NiaIndexSource[] =>
    trial.sourceUrl ? [{
      title: `${trial.nctId}: ${trial.title}`,
      url: trial.sourceUrl,
      kind: "trial",
      snippet: [
        `Status: ${trial.status}`,
        `Phase: ${trial.phase ?? "not listed"}`,
        `Matched criteria: ${trial.matchedCriteria.join("; ")}`,
        `Missing criteria: ${trial.missingCriteria.join("; ")}`,
        `Review risks: ${trial.exclusionRisks.join("; ")}`,
        `Coordinator questions: ${trial.coordinatorQuestions.join("; ")}`,
      ].join("\n"),
    }] : [],
  );
  const paperSources = run.research?.selectedPapers.flatMap((paper): NiaIndexSource[] =>
    paper.url ? [{
      title: paper.title,
      url: paper.url,
      kind: "paper",
      snippet: paper.abstract ?? paper.relevanceReason,
    }] : [],
  ) ?? [];
  const voiceSources = run.patientVoice.flatMap((theme) =>
    (theme.sources ?? []).flatMap((source): NiaIndexSource[] =>
      source.url ? [{
        title: source.title,
        url: source.url,
        kind: source.source === "x" ? "x" : "web",
        snippet: source.snippet ?? theme.summary,
      }] : [],
    ),
  );
  const expertSources = (run.expertSources ?? []).flatMap((source): NiaIndexSource[] =>
    source.url ? [{
      title: `Expert context: ${source.title}`,
      url: source.url,
      kind: source.source === "x" ? "x" : "web",
      snippet: source.snippet ?? "Expert-facing public context retrieved for clinician-reviewed discussion prep.",
    }] : [],
  );
  return [...trialSources, ...paperSources, ...voiceSources, ...expertSources];
}
