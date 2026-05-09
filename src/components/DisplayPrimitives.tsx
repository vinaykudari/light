import type { ReactNode } from "react";
import styles from "./LightDashboard.module.css";

export function Title({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div>
      <p className={styles.eyebrow}>{kicker}</p>
      <h2>{title}</h2>
    </div>
  );
}

export function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <ul className={styles.cleanList}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  ) : <Empty text={empty} />;
}

export function Empty({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}

export function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section className={`${styles.cardPanel} panel`}>
      <Title kicker={kicker} title={title} />
      {children}
    </section>
  );
}
