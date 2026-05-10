"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TrialCard } from "@/lib/types";
import { Empty } from "./DisplayPrimitives";
import { MarkdownMessage, ThinkingBubble } from "./MarkdownMessage";
import styles from "./LightDashboard.module.css";

type TrialChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TrialChatResponse = {
  answer?: string;
  error?: string;
  scope?: { kind?: string; trialId?: string };
  sourceMode?: "real" | "mixed" | "mock";
  indexedSources?: Array<{ title: string; url: string; kind: string; status: string }>;
};

export function TrialChatPanel({
  apiBase = "",
  runId,
  runStatus,
  trial,
}: {
  apiBase?: string;
  runId?: string;
  runStatus?: string;
  trial: TrialCard;
}) {
  const [messages, setMessages] = useState<TrialChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("waiting");
  const [sources, setSources] = useState<TrialChatResponse["indexedSources"]>([]);
  const [loading, setLoading] = useState(false);
  const ready = Boolean(runId && runStatus === "completed");
  const suggestions = useMemo(() => [
    "What should we verify before referral?",
    "Which parts of my profile does this trial appear to connect with?",
    "What public patient or expert concerns should I ask about?",
  ], []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runId || !question.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: question.trim() }];
    setMessages(next);
    setQuestion("");
    setLoading(true);
    setStatus("indexing trial corpus");
    const response = await fetch(`${apiBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        trialId: trial.nctId,
        question: question.trim(),
        history: messages,
      }),
    });
    const json = await response.json() as TrialChatResponse;
    setLoading(false);
    if (!response.ok || !json.answer) {
      const text = json.error ?? "Chat failed.";
      setStatus(text);
      setMessages([...next, { role: "assistant", content: text }]);
      return;
    }
    const indexed = json.indexedSources?.filter((source) => source.status === "indexed").length ?? 0;
    setSources(json.indexedSources ?? []);
    setStatus(`${json.scope?.kind ?? "trial"} scope / ${indexed} sources`);
    setMessages([...next, { role: "assistant", content: json.answer }]);
  }

  return (
    <section className={styles.trialChat}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.microLabel}>Trial chat</p>
          <strong>{trial.nctId} evidence copilot</strong>
        </div>
        <span className={styles.badge}>{loading ? "thinking" : status}</span>
      </div>
      <div className={styles.chatGrid}>
        <div className={styles.chatLog} aria-live="polite">
          {!messages.length ? <Empty text="Ask about this trial. Light scopes the answer to the official record plus indexed papers, patient voice, expert context, and run evidence." /> : null}
          {messages.map((message, index) => (
            <article className={styles.chatBubble} data-role={message.role} key={`${message.role}-${index}`}>
              <strong>{message.role === "user" ? "You" : "Light trial copilot"}</strong>
              {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
            </article>
          ))}
          {loading ? <ThinkingBubble label="Light trial copilot" /> : null}
        </div>
        <div className={styles.chatSources}>
          <strong>Indexed sources</strong>
          {!sources?.length ? <p className="muted">Sources appear after the first answer.</p> : null}
          {(sources ?? []).slice(0, 6).map((source) => (
            <a href={source.url} key={`${source.kind}-${source.url}`} target="_blank" rel="noreferrer">
              <span>{source.kind} / {source.status}</span>
              {source.title}
            </a>
          ))}
        </div>
      </div>
      <div className={styles.suggestionRow}>
        {suggestions.map((item) => (
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
