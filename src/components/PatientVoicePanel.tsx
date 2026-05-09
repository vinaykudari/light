import type { PatientVoiceTheme } from "@/lib/types";
import { Empty, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function PatientVoicePanel({ themes }: { themes: PatientVoiceTheme[] }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Concerns" title="Patient Voice" />
      {!themes.length ? <Empty text="Patient voice themes will appear after processing." /> : (
        <div className={styles.stack}>
          {themes.map((theme) => (
            <article className={styles.subCard} key={theme.theme}>
              <strong>{theme.theme}</strong>
              <p>{theme.sentiment} sentiment / {theme.signalStrength} signal / {theme.sourceCount} sources</p>
              <p>{theme.summary}</p>
              <p><b>Ask:</b> {theme.coordinatorQuestion}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
