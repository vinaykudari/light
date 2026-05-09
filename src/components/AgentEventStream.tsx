import type { AgentEvent, RunStatus } from "@/lib/types";
import { Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function AgentEventStream({ events, status }: { events: AgentEvent[]; status: RunStatus }) {
  return (
    <section className={`${styles.streamPanel} panel`}>
      <div className={styles.panelHeader}>
        <Title kicker="Agent stream" title="Live events" />
        <span className={styles.badge}>{status}</span>
      </div>
      <ol className={styles.eventList} aria-live="polite">
        {events.map((event, index) => (
          <li key={event.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{event.agent.replace("_", " ")} / {event.status}</strong>
              <p>{event.title}</p>
              <small>{event.detail}</small>
            </div>
          </li>
        ))}
        {!events.length ? <li><span>00</span><div><strong>ready</strong><p>Click Process to start agents.</p></div></li> : null}
      </ol>
    </section>
  );
}
