"use client";

import { useEffect, useMemo, useState } from "react";
import type { EligibilityRow, PatientVoiceTheme, ResearchSummary, TrialCard } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function TrialExplorer({
  trials,
  eligibility,
  research,
  voice,
}: {
  trials: TrialCard[];
  eligibility: EligibilityRow[];
  research?: ResearchSummary;
  voice: PatientVoiceTheme[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => trials.find((trial) => trial.nctId === selectedId) ?? trials[0], [selectedId, trials]);
  const row = eligibility.find((item) => item.trialId === selected?.nctId);

  useEffect(() => {
    if (!trials.length) setSelectedId(null);
    if (trials.length && !trials.some((trial) => trial.nctId === selectedId)) setSelectedId(trials[0].nctId);
  }, [selectedId, trials]);

  return (
    <section className={`${styles.commandPanel} panel`} id="trial-matches">
      <div className={styles.panelHeader}>
        <Title kicker="Clinical trial command center" title="Trial Matches" />
        <span className={styles.badge}>{trials.length ? `${trials.length} live candidates` : "waiting"}</span>
      </div>
      {!selected ? <Empty text="Run the agents to open a trial dashboard." /> : (
        <div className={styles.trialConsole}>
          <div className={styles.trialRail}>
            {trials.map((trial) => (
              <button
                className={trial.nctId === selected.nctId ? styles.activeTrial : ""}
                key={trial.nctId}
                onClick={() => setSelectedId(trial.nctId)}
                type="button"
              >
                <span>{trial.nctId}</span>
                <strong>{trial.title}</strong>
                <small>{trial.status}</small>
              </button>
            ))}
          </div>
          <article className={styles.trialDashboard}>
            <div className={styles.trialHero}>
              <div>
                <p className={styles.eyebrow}>{selected.nctId}</p>
                <h3>{selected.title}</h3>
                <p>{selected.phase ?? "Phase not listed"} / {locationText(selected)}</p>
              </div>
              {selected.sourceUrl ? (
                <a className={styles.neonLink} href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  official record
                </a>
              ) : null}
            </div>
            <div className={styles.statGrid}>
              <span><b>Status</b>{selected.status}</span>
              <span><b>Source</b>{selected.source}</span>
              <span><b>Sites</b>{selected.locations.length || "not listed"}</span>
              <span><b>Distance</b>{selected.distanceMiles ? `${selected.distanceMiles} mi` : "verify"}</span>
            </div>
            <div className={styles.dashboardBlocks}>
              <Block title="Why It Matched" items={selected.matchedCriteria} empty="No matched criteria extracted." />
              <Block title="Needs Verification" items={[...(row?.missingData ?? selected.missingCriteria), ...(row?.possibleExclusionRisks ?? selected.exclusionRisks)]} empty="No verification gaps extracted." />
              <Block title="Coordinator Questions" items={selected.coordinatorQuestions} empty="No coordinator questions extracted." />
              <Block title="Research Linked To This Profile" items={paperLines(research)} empty="Research papers will connect after retrieval." />
              <Block title="Patient / Expert Sentiment" items={voice.slice(0, 3).map((theme) => `${theme.theme}: ${theme.summary}`)} empty="Sentiment themes will appear after web and X searches." />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function Block({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className={styles.consoleBlock}>
      <strong>{title}</strong>
      <List items={items.slice(0, 5)} empty={empty} />
    </section>
  );
}

function paperLines(summary?: ResearchSummary): string[] {
  return summary?.selectedPapers.slice(0, 4).map((paper) => `${paper.title}${paper.year ? ` (${paper.year})` : ""}`) ?? [];
}

function locationText(trial: TrialCard): string {
  const first = trial.locations[0];
  if (!first) return "Location not listed";
  return [first.facility, first.city, first.state].filter(Boolean).join(", ");
}
