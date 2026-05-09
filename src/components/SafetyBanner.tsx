import styles from "./LightDashboard.module.css";

export function SafetyBanner() {
  return (
    <section className={`${styles.banner} panel`} role="status">
      <strong>For education and clinician-reviewed referral preparation only.</strong>
      <span>
        Light does not provide medical advice, determine trial eligibility, or recommend treatment. Public posts are unverified patient-experience signals.
      </span>
    </section>
  );
}
