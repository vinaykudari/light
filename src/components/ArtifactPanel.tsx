import type { GeneratedArtifact } from "@/lib/types";
import { Empty, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function ArtifactPanel({ artifacts }: { artifacts: GeneratedArtifact[] }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Outputs" title="Generated Artifacts" />
      {!artifacts.length ? <Empty text="Briefing, checklist, email, and missing-data artifacts will appear after processing." /> : (
        <div className={styles.artifactGrid}>
          {artifacts.map((artifact) => (
            <article className={styles.artifact} key={artifact.kind}>
              <strong>{artifact.title}</strong>
              <pre>{artifact.content}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
