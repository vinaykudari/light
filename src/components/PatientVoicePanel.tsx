import type { PatientVoiceSource, PatientVoiceTheme } from "@/lib/types";
import { Empty, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function PatientVoicePanel({ themes, expertSources }: { themes: PatientVoiceTheme[]; expertSources: PatientVoiceSource[] }) {
  const sources = dedupeSources(themes.flatMap((theme) => theme.sources ?? []));
  const xSources = sources.filter((source) => source.source === "x" || /(?:x|twitter)\.com/i.test(source.url ?? ""));
  const webSources = sources.filter((source) => !xSources.includes(source));
  const experts = dedupeSources(expertSources);
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker="Signals" title="Patient + Expert" />
      {!themes.length && !experts.length ? <Empty text="Patient and expert signals will appear after processing." /> : (
        <div className={styles.stack}>
          {themes.length ? (
            <div className={styles.signalGrid}>
              {themes.map((theme) => (
                <article className={styles.subCard} key={theme.theme}>
                  <span className={styles.microLabel}>{theme.sentiment} / {theme.signalStrength} / {theme.sourceCount} sources</span>
                  <strong>{theme.theme}</strong>
                  <p>{theme.summary}</p>
                  <p><b>Ask:</b> {theme.coordinatorQuestion}</p>
                  <SourceLinks sources={theme.sources ?? []} />
                </article>
              ))}
            </div>
          ) : null}
          <SourceSection title="Expert Context" empty="Expert-facing public commentary will appear when X or web retrieval returns usable sources." sources={experts} />
          <SourceSection title="X.com Signals" empty="X recent search is unavailable or returned no usable public posts for this run." sources={xSources} />
          <SourceSection title="Web Search Signals" empty="Web search sources will appear when linked context returns." sources={webSources} />
        </div>
      )}
    </section>
  );
}

function SourceLinks({ sources }: { sources: PatientVoiceSource[] }) {
  const visible = dedupeSources(sources).slice(0, 3);
  if (!visible.length) return null;
  return (
    <div className={styles.inlineSources}>
      {visible.map((source) => (
        source.url ? (
          <a href={source.url} key={`${source.source}-${source.url}`} target="_blank" rel="noreferrer">
            <span>{source.source}</span>
            {source.title}
          </a>
        ) : (
          <span key={`${source.source}-${source.title}`}>
            <b>{source.source}</b>
            {source.title}
          </span>
        )
      ))}
    </div>
  );
}

function SourceSection({ title, sources, empty }: { title: string; sources: PatientVoiceSource[]; empty: string }) {
  return (
    <section className={styles.subCard}>
      <strong>{title}</strong>
      {!sources.length ? <Empty text={empty} /> : (
        <div className={styles.sourceGrid}>
          {sources.slice(0, 6).map((source) => (
            <article className={styles.sourceCard} key={`${source.url ?? source.title}-${source.snippet ?? ""}`}>
              <span>{source.source}</span>
              {source.url ? (
                <a className={styles.sourceLink} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              ) : <strong>{source.title}</strong>}
              {source.snippet ? <p>{source.snippet}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function dedupeSources(sources: PatientVoiceSource[]): PatientVoiceSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url ?? `${source.title}:${source.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
