import styles from "./LightDashboard.module.css";

export function SafetyBanner() {
  return (
    <section className={`${styles.banner} panel`} role="status">
      <strong>Education and clinician-reviewed referral prep only.</strong>
      <span>
        Light does not diagnose, recommend treatment, or determine eligibility. Public posts are unverified signals.
      </span>
    </section>
  );
}
