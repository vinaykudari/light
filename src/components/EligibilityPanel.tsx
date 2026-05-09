import type { EligibilityRow } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function EligibilityPanel({ rows }: { rows: EligibilityRow[] }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Screening" title="Eligibility" />
      {!rows.length ? <Empty text="Eligibility matrix will appear after processing." /> : (
        <div className={styles.stack}>
          {rows.map((row) => (
            <article className={styles.subCard} key={row.trialId}>
              <strong>{row.trialId}</strong>
              <p>{row.reviewNote}</p>
              <List items={row.matchedCriteria.map((item) => `Matched: ${item}`)} empty="No matched criteria extracted." />
              <List items={row.missingData.map((item) => `Missing: ${item}`)} empty="No missing data extracted." />
              <List items={row.possibleExclusionRisks.map((item) => `Review: ${item}`)} empty="No exclusion risks extracted." />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
