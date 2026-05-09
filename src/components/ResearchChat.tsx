"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TrialIntelligenceState } from "@/lib/types";
import { Empty, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  answer: string;
  indexedSources: Array<{ title: string; url: string; kind: string; status: string }>;
  sourceMode: "real" | "mixed" | "mock";
};

export function ResearchChat({ run }: { run: TrialIntelligenceState | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<ChatResponse["indexedSources"]>([]);
  const [status, setStatus] = useState<string>("waiting for run");
  const [loading, setLoading] = useState(false);
  const ready = run?.status === "completed";
  const suggestions = useMemo(() => [
    "Which trial looks most relevant to the symptoms and why?",
    "What missing information should the doctor collect before referral?",
    "What do research papers and patient voice signals agree on?",
  ], []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!run || !question.trim() || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: question.trim() }];
    setMessages(nextMessages);
    setQuestion("");
    setLoading(true);
    setStatus("indexing sources");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.runId, question: question.trim(), history: messages }),
    });
    const json = await response.json() as Partial<ChatResponse> & { error?: string };
    setLoading(false);
    if (!response.ok || !json.answer) {
      setStatus(json.error ?? "chat failed");
      setMessages([...nextMessages, { role: "assistant", content: json.error ?? "Chat failed." }]);
      return;
    }
    setSources(json.indexedSources ?? []);
    setStatus(`${json.sourceMode ?? "mixed"} answer / ${json.indexedSources?.filter((source) => source.status === "indexed").length ?? 0} sources`);
    setMessages([...nextMessages, { role: "assistant", content: json.answer }]);
  }

  return (
    <section className={`${styles.cardPanel} panel`} id="research-chat">
      <div className={styles.panelHeader}>
        <Title kicker="Chat" title="Ask Light" />
        <span className={styles.badge}>{loading ? "thinking" : status}</span>
      </div>
      <div className={styles.chatGrid}>
        <div className={styles.chatLog} aria-live="polite">
          {!messages.length ? <Empty text="Run the agents, then ask about trials, papers, evidence, sentiment, missing data, or coordinator questions." /> : null}
          {messages.map((message, index) => (
            <article className={styles.chatBubble} data-role={message.role} key={`${message.role}-${index}`}>
              <strong>{message.role === "user" ? "You" : "Light research agent"}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
        <div className={styles.chatSources}>
          <strong>Sources</strong>
          {!sources.length ? <p className="muted">Sources will appear after your first question.</p> : null}
          {sources.slice(0, 8).map((source) => (
            <a href={source.url} key={`${source.url}-${source.kind}`} target="_blank" rel="noreferrer">
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
        <input
          disabled={!ready || loading}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={ready ? "Ask about the indexed trials, papers, PDFs, X/web sentiment, or eligibility gaps..." : "Chat unlocks after the run completes"}
          value={question}
        />
        <button className={styles.primaryButton} disabled={!ready || loading || !question.trim()} type="submit">
          Ask
        </button>
      </form>
    </section>
  );
}
