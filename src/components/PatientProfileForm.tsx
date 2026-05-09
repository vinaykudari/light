import { Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export type PatientFormState = {
  diagnosis: string;
  biomarkers: string;
  priorTherapies: string;
  location: string;
  maxTravelMiles: string;
  preferences: string;
  missingDataHints: string;
};

const labels: Record<keyof PatientFormState, string> = {
  diagnosis: "Diagnosis",
  biomarkers: "Biomarkers",
  priorTherapies: "Prior therapy",
  location: "Location",
  maxTravelMiles: "Travel limit in miles",
  preferences: "Preferences",
  missingDataHints: "Missing info",
};

export function PatientProfileForm({
  form,
  isProcessing,
  onChange,
  onSubmit,
}: {
  form: PatientFormState;
  isProcessing: boolean;
  onChange: (next: PatientFormState) => void;
  onSubmit: () => void;
}) {
  function update(field: keyof PatientFormState, value: string) {
    onChange({ ...form, [field]: value });
  }

  return (
    <section className={`${styles.formPanel} panel`}>
      <div className={styles.panelHeader}>
        <Title kicker="Synthetic patient" title="Prefilled profile" />
        <button className={styles.primaryButton} onClick={onSubmit} disabled={isProcessing}>
          {isProcessing ? "Processing..." : "Process Trial Intelligence"}
        </button>
      </div>
      <div className={styles.formGrid}>
        {(Object.keys(form) as Array<keyof PatientFormState>).map((field) => (
          <label key={field} className={styles.field}>
            <span>{labels[field]}</span>
            {field === "preferences" || field === "missingDataHints" ? (
              <textarea value={form[field]} onChange={(event) => update(field, event.target.value)} rows={4} />
            ) : (
              <input value={form[field]} onChange={(event) => update(field, event.target.value)} />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
