import type { ResearchSummary } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function ResearchPanel({ summary }: { summary?: ResearchSummary }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Evidence" title="Research" />
      {!summary ? <Empty text="Research summaries will appear after processing." /> : (
        <div className={styles.stack}>
          <div className={styles.queryPill}>{summary.query}</div>
          <div className={styles.paperGrid}>
            {summary.selectedPapers.slice(0, 6).map((paper) => (
              <article className={styles.subCard} key={paper.title}>
                <span className={styles.microLabel}>{paper.source}{paper.year ? ` / ${paper.year}` : ""}</span>
                <strong>
                  {paper.url ? <a className={styles.sourceLink} href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a> : paper.title}
                </strong>
                <p>{snippet(paper.abstract ?? paper.relevanceReason)}</p>
                <p><b>Profile relevance:</b> {paper.relevanceReason}</p>
              </article>
            ))}
          </div>
          <section className={styles.subCard}>
            <strong>Connected research themes</strong>
            <List items={summary.themes} empty="No research themes available." />
          </section>
          <section className={styles.subCard}>
            <strong>Clinician review questions</strong>
            <List items={summary.clinicianQuestions} empty="No clinician questions available." />
          </section>
        </div>
      )}
    </section>
  );
}

function snippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}
