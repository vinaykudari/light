import type { AgentEvent, CapabilityReport } from "@/lib/types";
import styles from "./LightDashboard.module.css";

type Sponsor = {
  name: string;
  domain: string;
  use: string;
  match: RegExp;
  capability?: keyof CapabilityReport;
};

const sponsors: Sponsor[] = [
  { name: "Tensorlake", domain: "tensorlake.ai", use: "sandbox orchestration", match: /tensorlake|workflow executor/i, capability: "tensorlake" },
  { name: "Nia", domain: "trynia.ai", use: "web, papers, patient voice", match: /nia|web context/i, capability: "nia" },
  { name: "Hyperspell", domain: "hyperspell.com", use: "clinic memory recall", match: /hyperspell|clinic memory/i, capability: "hyperspell" },
  { name: "Convex", domain: "convex.dev", use: "realtime state model", match: /realtime|state|dashboard/i },
  { name: "X.com", domain: "x.com", use: "public patient signals", match: /x api|x\.com|public post|patient-experience/i, capability: "xPublicSearch" },
  { name: "OpenAI", domain: "openai.com", use: "agent reasoning", match: /llm|synthes|extract|rank/i, capability: "llm" },
  { name: "ClinicalTrials.gov", domain: "clinicaltrials.gov", use: "official trial records", match: /clinicaltrials|trial records|nct/i, capability: "clinicalTrials" },
  { name: "PubMed", domain: "ncbi.nlm.nih.gov", use: "paper retrieval", match: /pubmed|papers|research/i, capability: "pubMed" },
];

export function SponsorRail({ events, capabilities }: { events: AgentEvent[]; capabilities?: CapabilityReport }) {
  return (
    <section className={styles.sponsorRail} aria-label="Sponsor integrations">
      {sponsors.map((sponsor) => {
        const live = events.some((event) => sponsor.match.test(`${event.title} ${event.detail} ${event.agent}`));
        const ready = sponsor.capability ? capabilities?.[sponsor.capability] ?? true : true;
        return (
          <article className={styles.sponsorCard} data-live={live || undefined} key={sponsor.name}>
            <img src={`https://www.google.com/s2/favicons?sz=64&domain=${sponsor.domain}`} alt="" />
            <div>
              <strong>{sponsor.name}</strong>
              <span>{live ? "in use now" : ready ? "armed" : "not configured"}</span>
              <p>{sponsor.use}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
