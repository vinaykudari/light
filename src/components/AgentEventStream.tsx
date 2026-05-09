import type { AgentEvent, RunStatus } from "@/lib/types";
import { Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function AgentEventStream({ events, status }: { events: AgentEvent[]; status: RunStatus }) {
  return (
    <section className={`${styles.streamPanel} panel`}>
      <div className={styles.panelHeader}>
        <Title kicker="Neural feed" title="Live Agent Work" />
        <span className={styles.badge}>{status}</span>
      </div>
      <ol className={styles.eventList} aria-live="polite">
        {events.map((event, index) => (
          <li data-status={event.status} key={event.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{event.agent.replace("_", " ")} / {event.status}</strong>
              <em>{sponsorForEvent(event)}</em>
              <p>{event.title}</p>
              <small>{event.detail}</small>
              {event.metadata?.sourceUrl ? (
                <a className={styles.sourceLink} href={String(event.metadata.sourceUrl)} target="_blank" rel="noreferrer">
                  Open source
                </a>
              ) : null}
            </div>
          </li>
        ))}
        {!events.length ? <li><span>00</span><div><strong>ready</strong><p>Click Process to start agents.</p></div></li> : null}
      </ol>
    </section>
  );
}

function sponsorForEvent(event: AgentEvent): string {
  const text = `${event.agent} ${event.title} ${event.detail}`;
  if (/tensorlake|workflow executor/i.test(text)) return "powered by Tensorlake";
  if (/nia|web context/i.test(text)) return "powered by Nia";
  if (/hyperspell|clinic memory/i.test(text)) return "powered by Hyperspell";
  if (/x api|x\.com|public patient/i.test(text)) return "powered by X.com + web";
  if (/clinicaltrials|nct|trial records/i.test(text)) return "powered by ClinicalTrials.gov";
  if (/pubmed|research papers/i.test(text)) return "powered by PubMed";
  if (/synthes|extract|ranking|briefing/i.test(text)) return "powered by GPT-5.4 mini";
  return "Light orchestration";
}
