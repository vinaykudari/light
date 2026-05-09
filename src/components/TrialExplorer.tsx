"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { EligibilityRow, PatientVoiceSource, PatientVoiceTheme, ResearchPaper, ResearchSummary, TrialCard } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import { MarkdownMessage, ThinkingBubble } from "./MarkdownMessage";
import styles from "./LightDashboard.module.css";

export function TrialExplorer({
  trials,
  eligibility,
  research,
  voice,
  runId,
  runStatus,
}: {
  trials: TrialCard[];
  eligibility: EligibilityRow[];
  research?: ResearchSummary;
  voice: PatientVoiceTheme[];
  runId?: string;
  runStatus?: string;
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
        <Title kicker="Matches" title="Trials" />
        <span className={styles.badge}>{trials.length ? `${trials.length} candidates` : "waiting"}</span>
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
              <ResearchLinks papers={research?.selectedPapers ?? []} />
              <VoiceLinks themes={voice} />
            </div>
            <TrialScopedChat runId={runId} runStatus={runStatus} trial={selected} />
          </article>
        </div>
      )}
    </section>
  );
}

type TrialChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function TrialScopedChat({ runId, runStatus, trial }: { runId?: string; runStatus?: string; trial: TrialCard }) {
  const [messages, setMessages] = useState<TrialChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("ready");
  const [loading, setLoading] = useState(false);
  const ready = Boolean(runId && runStatus === "completed");

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runId || !question.trim() || loading) return;
    const scopedQuestion = `For ${trial.nctId}, ${question.trim()}`;
    const next = [...messages, { role: "user" as const, content: question.trim() }];
    setMessages(next);
    setQuestion("");
    setLoading(true);
    setStatus("indexing sources");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, question: scopedQuestion, history: messages }),
    });
    const json = await response.json() as { answer?: string; error?: string; scope?: { kind?: string }; indexedSources?: Array<{ status: string }> };
    setLoading(false);
    if (!response.ok || !json.answer) {
      setStatus(json.error ?? "chat failed");
      setMessages([...next, { role: "assistant", content: json.error ?? "Chat failed." }]);
      return;
    }
    const indexed = json.indexedSources?.filter((source) => source.status === "indexed").length ?? 0;
    setStatus(`${json.scope?.kind ?? "trial"} scope / ${indexed} sources`);
    setMessages([...next, { role: "assistant", content: json.answer }]);
  }

  return (
    <section className={styles.trialChat}>
      <div className={styles.panelHeader}>
        <Title kicker="Chat" title={`Ask ${trial.nctId}`} />
        <span className={styles.badge}>{loading ? "thinking" : status}</span>
      </div>
      <div className={styles.chatLog} aria-live="polite">
        {!messages.length ? <Empty text="Ask trial-specific questions. The chat is scoped to this NCT record and the indexed evidence corpus." /> : null}
        {messages.map((message, index) => (
          <article className={styles.chatBubble} data-role={message.role} key={`${message.role}-${index}`}>
            <strong>{message.role === "user" ? "You" : "Light trial copilot"}</strong>
            {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
          </article>
        ))}
        {loading ? <ThinkingBubble label="Light trial copilot" /> : null}
      </div>
      <div className={styles.suggestionRow}>
        {["What should we verify before referral?", "Which symptoms does this trial appear to target?", "What should we ask the coordinator?"].map((item) => (
          <button disabled={!ready || loading} key={item} onClick={() => setQuestion(item)} type="button">{item}</button>
        ))}
      </div>
      <form className={styles.chatForm} onSubmit={ask}>
        <input disabled={!ready || loading} onChange={(event) => setQuestion(event.target.value)} placeholder={ready ? `Ask about ${trial.nctId}...` : "Trial chat unlocks when the run completes"} value={question} />
        <button className={styles.primaryButton} disabled={!ready || loading || !question.trim()} type="submit">Ask</button>
      </form>
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

function ResearchLinks({ papers }: { papers: ResearchPaper[] }) {
  return (
    <section className={styles.consoleBlock}>
      <strong>Related Research</strong>
      {!papers.length ? <Empty text="Research papers will connect after retrieval." /> : (
        <div className={styles.inlineSources}>
          {papers.slice(0, 4).map((paper) => (
            paper.url ? (
              <a href={paper.url} key={paper.title} target="_blank" rel="noreferrer">
                <span>{paper.source}{paper.year ? ` / ${paper.year}` : ""}</span>
                {paper.title}
              </a>
            ) : (
              <span key={paper.title}>
                <b>{paper.source}{paper.year ? ` / ${paper.year}` : ""}</b>
                {paper.title}
              </span>
            )
          ))}
        </div>
      )}
    </section>
  );
}

function VoiceLinks({ themes }: { themes: PatientVoiceTheme[] }) {
  const sources = dedupeSources(themes.flatMap((theme) => theme.sources ?? [])).slice(0, 4);
  return (
    <section className={styles.consoleBlock}>
      <strong>Patient Voice</strong>
      {!themes.length ? <Empty text="Patient voice themes will appear after retrieval." /> : (
        <div className={styles.linkStack}>
          <List items={themes.slice(0, 2).map((theme) => `${theme.theme}: ${theme.summary}`)} empty="No patient voice themes yet." />
          {sources.length ? (
            <div className={styles.inlineSources}>
              {sources.map((source) => (
                source.url ? (
                  <a href={source.url} key={`${source.source}-${source.url}`} target="_blank" rel="noreferrer">
                    <span>{source.source}</span>
                    {source.title}
                  </a>
                ) : (
                  <span key={`${source.source}-${source.title}`}>
                    <b>{source.source}</b>
                    {source.title}
                  </span>
                )
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function dedupeSources(sources: PatientVoiceSource[]): PatientVoiceSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url ?? `${source.source}:${source.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function locationText(trial: TrialCard): string {
  const first = trial.locations[0];
  if (!first) return "Location not listed";
  return [first.facility, first.city, first.state].filter(Boolean).join(", ");
}
