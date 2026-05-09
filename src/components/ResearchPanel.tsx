import type { ResearchSummary } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function ResearchPanel({ summary }: { summary?: ResearchSummary }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Evidence" title="Research Evidence" />
      {!summary ? <Empty text="Research summaries will appear after processing." /> : (
        <div className={styles.stack}>
          <p className="muted">Query: {summary.query}</p>
          <List items={summary.themes} empty="No research themes available." />
          {summary.selectedPapers.slice(0, 4).map((paper) => (
            <article className={styles.subCard} key={paper.title}>
              <strong>
                {paper.url ? <a className={styles.sourceLink} href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a> : paper.title}
              </strong>
              <p>{paper.source}{paper.year ? ` / ${paper.year}` : ""}</p>
              <p>{paper.relevanceReason}</p>
            </article>
          ))}
          <List items={summary.clinicianQuestions} empty="No clinician questions available." />
        </div>
      )}
    </section>
  );
}
