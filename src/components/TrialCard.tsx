import type { TrialCard as TrialCardType } from "@/lib/types";
import { List } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function TrialCard({ trial }: { trial: TrialCardType }) {
  return (
    <article className={styles.trialCard}>
      <div className={styles.trialTopline}>
        <h3>{trial.nctId}: {trial.title}</h3>
        <span>{trial.status}</span>
      </div>
      <p className="muted">
        {trial.phase ?? "Phase not listed"} / {locationText(trial)} {trial.distanceMiles ? `/ ${trial.distanceMiles} mi` : ""}
      </p>
      <div className={styles.tags}>
        {trial.matchedCriteria.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
      </div>
      <List items={trial.missingCriteria.map((item) => `Missing: ${item}`)} empty="No missing criteria extracted." />
      <List items={trial.exclusionRisks.map((item) => `Review: ${item}`)} empty="No exclusion risks extracted." />
      <List items={trial.coordinatorQuestions} empty="No coordinator questions extracted." />
    </article>
  );
}

function locationText(trial: TrialCardType): string {
  const first = trial.locations[0];
  if (!first) return "Location not listed";
  return [first.facility, first.city, first.state].filter(Boolean).join(", ");
}
