"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { seedPatient } from "@/lib/demo/seedPatient";
import { longCovidTranscript, longCovidPatient } from "@/lib/demo/longCovidDemo";
import type {
  AgentEvent,
  AgentName,
  PatientProfile,
  PatientProfileInput,
  PatientVoiceSource,
  PatientVoiceTheme,
  TrialIntelligenceState, TrialCard as TrialCardType,
} from "@/lib/types";
import { AgentEventStream } from "./AgentEventStream";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { ArtifactPanel } from "./ArtifactPanel";
import type { ConversationPayload } from "./DoctorConversationDemo";
import { EligibilityPanel } from "./EligibilityPanel";
import type { PatientFormState } from "./PatientProfileForm";
import { PatientVoicePanel } from "./PatientVoicePanel";
import { ResearchPanel } from "./ResearchPanel";
import { Empty } from "./DisplayPrimitives";
import { MarkdownMessage } from "./MarkdownMessage";
import { SponsorRail } from "./SponsorRail";
import { TrialChatPanel } from "./TrialChatPanel";
import styles from "./LightDashboard.module.css";

const HDR = [styles.trialHeaderBlue1, styles.trialHeaderBlue2, styles.trialHeaderBlue3];

type Step = "landing" | "intake" | "conversation" | "processing" | "dashboard";
type ViewMode = "patient" | "technical";
type PatientTab = "trials" | "community" | "prepare" | "feed";
type TechTab = "architecture" | "agents" | "research" | "voice" | "eligibility" | "artifacts";
type TrialEnrichment = {
  briefSummary?: string;
  dosing?: string;
  sponsor?: string;
  sponsorClass?: string;
  enrollmentCount?: number;
  allocation?: string;
  minAge?: string;
  maxAge?: string;
  completionDate?: string;
  startDate?: string;
};
type LiveFeedItem = {
  id: string;
  kind: "trial" | "paper" | "patient" | "expert";
  title: string;
  sourceLabel: string;
  detailLabel: string;
  body?: string;
  url?: string;
};

// Remote backend — CORS is open, so localhost UI can call directly
const API = "https://light.hackerpod.dev";

// ─── Component ────────────────────────────────────────────────────────────────
export function LightDashboard() {
  // ── Existing state + functions (DO NOT CHANGE) ───────────────────────────────
  const [form] = useState<PatientFormState>(toForm(seedPatient));
  const [run, setRun] = useState<TrialIntelligenceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isProcessing = run?.status === "created" || run?.status === "running";

  // Poll remote backend for run state
  useEffect(() => {
    if (!run || !isProcessing) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`${API}/api/runs?id=${encodeURIComponent(run.runId)}`);
      if (!res.ok) return;
      const next = (await res.json()) as TrialIntelligenceState;
      setRun(next);
      if (next.status === "completed" || next.status === "failed") window.clearInterval(timer);
    }, 700);
    return () => window.clearInterval(timer);
  }, [run, isProcessing]);

  const sourceMode = useMemo(() => (!run ? "demo ready" : `${run.sourceMode} mode`), [run]);

  async function processIntelligence() {
    setError(null);
    const res = await fetch(`${API}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient: toPatientInput(form) }),
    });
    if (!res.ok) { setError("Run could not be started."); return; }
    setRun((await res.json()) as TrialIntelligenceState);
  }

  async function processConversation(payload: ConversationPayload) {
    setError(null);
    const res = await fetch(`${API}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setError("Conversation run could not be started."); return; }
    setRun((await res.json()) as TrialIntelligenceState);
  }

  const questions = dedupe([
    ...(run?.burden?.coordinatorQuestions ?? []),
    ...((run?.patientVoice ?? []).map((t) => t.coordinatorQuestion)),
  ]);

  // ── New UX state ──────────────────────────────────────────────────────────
  const [step, setStep]               = useState<Step>("landing");
  const [viewMode, setViewMode]       = useState<ViewMode>("patient");
  const [patientTab, setPatientTab]   = useState<PatientTab>("trials");
  const [techTab, setTechTab]         = useState<TechTab>("agents");
  const [selectedTrial, setSelectedTrial] = useState<TrialCardType | null>(null);
  const [detailTab, setDetailTab]     = useState<"sideeffects" | "evidence" | "signals">("sideeffects");
  const [chatInput, setChatInput]     = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "light"; text: string }[]>([]);
  const [listening, setListening]     = useState(false);
  const [emailText, setEmailText]     = useState("");
  const [emailSent, setEmailSent]     = useState(false);
  const [trialEnrichment, setTrialEnrichment] = useState<Record<string, TrialEnrichment>>({});
  const [copied, setCopied]           = useState<string | null>(null);

  // Conversation streaming state
  const [convCount, setConvCount]     = useState(0);
  const convProcessed                 = useRef(false);
  const convComplete                  = convCount >= longCovidTranscript.length;

  // Go to dashboard once the live backend starts streaming events.
  useEffect(() => {
    if (step === "processing" && (run?.events.length || run?.status === "completed")) {
      const t = setTimeout(() => setStep("dashboard"), 400);
      return () => clearTimeout(t);
    }
  }, [step, run?.events.length, run?.status]);

  // Auto-stream conversation turns
  useEffect(() => {
    if (step !== "conversation" || convComplete) return;
    const t = window.setTimeout(() => setConvCount((n) => n + 1), 700);
    return () => window.clearTimeout(t);
  }, [step, convCount, convComplete]);

  // Auto-process when conversation finishes streaming
  useEffect(() => {
    if (step !== "conversation" || !convComplete || convProcessed.current) return;
    convProcessed.current = true;
    const t = setTimeout(async () => {
      setStep("processing");
      await processConversation({
        patient: {
          age: longCovidPatient.age,
          diagnosis: longCovidPatient.diagnosis,
          biomarkers: longCovidPatient.biomarkers,
          priorTherapies: longCovidPatient.priorTherapies,
          location: longCovidPatient.location,
          maxTravelMiles: longCovidPatient.maxTravelMiles,
          preferences: longCovidPatient.preferences,
          missingDataHints: longCovidPatient.missingDataHints,
        },
        conversationTranscript: longCovidTranscript,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [convComplete, step]);

  // Fetch plain-language enrichment from ClinicalTrials.gov when a trial is selected
  useEffect(() => {
    if (!selectedTrial || trialEnrichment[selectedTrial.nctId]) return;
    fetch(`https://clinicaltrials.gov/api/v2/studies/${selectedTrial.nctId}?format=json`)
      .then(r => r.json())
      .then(d => {
        const ps = d?.protocolSection ?? {};
        const enrich = {
          briefSummary: ps.descriptionModule?.briefSummary,
          dosing: ps.armsInterventionsModule?.interventions?.[0]?.description,
          sponsor: ps.sponsorCollaboratorsModule?.leadSponsor?.name,
          sponsorClass: ps.sponsorCollaboratorsModule?.leadSponsor?.class,
          enrollmentCount: ps.designModule?.enrollmentInfo?.count,
          allocation: ps.designModule?.designInfo?.allocation,
          minAge: ps.eligibilityModule?.minimumAge,
          maxAge: ps.eligibilityModule?.maximumAge,
          completionDate: ps.statusModule?.completionDateStruct?.date,
          startDate: ps.statusModule?.startDateStruct?.date,
        };
        setTrialEnrichment(prev => ({ ...prev, [selectedTrial.nctId]: enrich }));
      })
      .catch(() => {});
  }, [selectedTrial?.nctId]);

  // Pre-fill email from artifacts
  useEffect(() => {
    if (!emailText && run?.artifacts?.length) {
      const art = run.artifacts.find((a) => a.kind === "coordinator_email");
      if (art) setEmailText(art.content);
    }
  }, [run?.artifacts, emailText]);

  function startConversation() {
    setConvCount(1);
    setStep("conversation");
  }

  async function startUpload() {
    setStep("processing");
    await processIntelligence();
  }

  // Pre-index run data into Nia when processing completes (makes chat fast)
  const indexed = useRef(false);
  useEffect(() => {
    if (run?.status !== "completed" || indexed.current) return;
    indexed.current = true;
    fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.runId, action: "index" }),
    }).catch(() => {}); // fire-and-forget
  }, [run?.status, run?.runId]);

  const [chatLoading, setChatLoading] = useState(false);

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run?.runId,
          question: q,
          history: chatMessages.map((m) => ({ role: m.role === "light" ? "assistant" : "user", content: m.text })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((m) => [...m, { role: "light", text: data.answer ?? "No answer returned." }]);
      } else {
        setChatMessages((m) => [...m, { role: "light", text: "Couldn't reach the chat service. Try again in a moment." }]);
      }
    } catch {
      setChatMessages((m) => [...m, { role: "light", text: "Couldn't reach the chat service. Are you connected?" }]);
    } finally {
      setChatLoading(false);
    }
  }

  function cp(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const isDone = run?.status === "completed";
  const liveEvents = run?.events ?? [];
  const agentVisuals = buildAgentVisuals(liveEvents);
  const feedItems = useMemo(() => buildFeedItems(run), [run]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className={styles.appNav}>
        <span className={styles.navLogo} onClick={() => setStep("landing")} style={{ cursor: "pointer" }}>
          light
        </span>
        {step === "dashboard" && (
          <div className={styles.modeToggle}>
            <button className={`${styles.modeSwitchBtn} ${viewMode === "patient" ? styles.modeSwitchBtnActive : ""}`}
              onClick={() => { setViewMode("patient"); setSelectedTrial(null); }}>
              Patient view
            </button>
            <button className={`${styles.modeSwitchBtn} ${viewMode === "technical" ? styles.modeSwitchBtnActive : ""}`}
              onClick={() => { setViewMode("technical"); setSelectedTrial(null); }}>
              ⚙ Under the hood
            </button>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          LANDING — one job: get them to click
          ══════════════════════════════════════════════════════════════════ */}
      {step === "landing" && (
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 24px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#93C5FD", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "20px", background: "#2563EB", padding: "6px 16px", borderRadius: "999px" }}>
            Clinical trial matching
          </p>
          <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 600, color: "#0D1117", maxWidth: "640px", lineHeight: 1.15, marginBottom: "20px" }}>
            No patient should make a clinical trial decision without the full picture.
          </h1>
          <p style={{ fontSize: "18px", color: "#6B7280", maxWidth: "440px", lineHeight: 1.6, marginBottom: "40px" }}>
            Light reads your context and finds clinical trials worth discussing with your clinician.
          </p>
          <button
            onClick={() => setStep("intake")}
            className="btn-primary"
            style={{ fontSize: "16px", padding: "16px 36px", borderRadius: "14px" }}>
            Find clinical trials →
          </button>
          <div style={{ display: "flex", gap: "32px", marginTop: "48px" }}>
            {[
              { value: "18,000+", label: "clinical trials recruiting" },
              { value: "< 30s",   label: "to your matches" },
              { value: "Free",    label: "for patients, always" },
            ].map((s) => (
              <div key={s.value} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: "22px", fontWeight: 600, color: "#2563EB", marginBottom: "4px" }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          INTAKE — two paths, one choice
          ══════════════════════════════════════════════════════════════════ */}
      {step === "intake" && (
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 24px" }}>
          <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "28px", fontWeight: 600, color: "#0D1117", marginBottom: "8px", textAlign: "center" }}>
            How would you like to share your situation?
          </h2>
          <p style={{ fontSize: "14px", color: "#9CA3AF", marginBottom: "36px", textAlign: "center" }}>
            Either path takes less than a minute.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "680px", width: "100%" }}>

            {/* Conversation card */}
            <button
              onClick={startConversation}
              style={{ background: "white", border: "2px solid #E2E8F0", borderRadius: "20px", padding: "32px 28px", textAlign: "left", cursor: "pointer", transition: "all 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2563EB"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>💬</div>
              <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "18px", fontWeight: 600, color: "#0D1117", marginBottom: "8px" }}>
                Walk me through it
              </div>
              <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6, marginBottom: "20px" }}>
                Answer a few questions like you're talking to a doctor. Light listens and finds clinical trial options.
              </p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#2563EB" }}>
                Start talking →
              </span>
            </button>

            {/* Upload card */}
            <button
              onClick={startUpload}
              style={{ background: "white", border: "2px solid #E2E8F0", borderRadius: "20px", padding: "32px 28px", textAlign: "left", cursor: "pointer", transition: "all 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2563EB"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>📎</div>
              <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "18px", fontWeight: 600, color: "#0D1117", marginBottom: "8px" }}>
                Upload my records
              </div>
              <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6, marginBottom: "20px" }}>
                Drop a PDF, clinical note, lab report, or referral letter. Light reads it and extracts your profile.
              </p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#2563EB" }}>
                Upload →
              </span>
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "24px", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" fill="#10B981" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            Your information is never shared — used only to find your options.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONVERSATION — streams automatically, no buttons
          ══════════════════════════════════════════════════════════════════ */}
      {step === "conversation" && (
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#EFF6FF", borderRadius: "999px", padding: "6px 16px", marginBottom: "14px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "999px", background: "#10B981", display: "inline-block", animation: "blink 1.5s ease infinite" }}/>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563EB" }}>Light is listening</span>
            </div>
            <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "22px", fontWeight: 600, color: "#0D1117" }}>
              Tell us what's going on
            </h2>
          </div>

          {/* Chat bubbles */}
          <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
            {longCovidTranscript.slice(0, convCount).map((turn, i) => {
              const isDoctor = turn.speaker === "doctor";
              return (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexDirection: isDoctor ? "row" : "row-reverse" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "999px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", background: isDoctor ? "#EFF6FF" : "#F0FDF4" }}>
                    {isDoctor ? "🩺" : "👤"}
                  </div>
                  <div style={{ maxWidth: "80%", fontSize: "14px", lineHeight: 1.6, padding: "12px 16px", borderRadius: isDoctor ? "4px 16px 16px 16px" : "16px 4px 16px 16px", background: isDoctor ? "#F8FAFC" : "#EFF6FF", color: isDoctor ? "#374151" : "#1E40AF" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: isDoctor ? "#9CA3AF" : "#60A5FA", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {isDoctor ? "Doctor" : "You"}
                    </div>
                    {turn.text}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {!convComplete && convCount > 0 && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "999px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>🩺</div>
                <div style={{ background: "#F8FAFC", borderRadius: "4px 16px 16px 16px", padding: "14px 18px", display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "999px", background: "#CBD5E1", display: "inline-block", animation: `blink 1.2s ease ${i*0.2}s infinite` }}/>)}
                </div>
              </div>
            )}

            {convComplete && (
              <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "13px" }}>
                Finding your trials…
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PROCESSING — same for both paths
          ══════════════════════════════════════════════════════════════════ */}
      {step === "processing" && (
        <div className={styles.processingWrap}>
          <div className={styles.processingCard}>
            <div className={styles.spinnerWrap}>
              {isDone
                ? <div className={styles.spinnerRingDone}>
                    <svg width="28" height="28" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                : <div className={styles.spinnerRing}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24"
                      className={styles.spinner} style={{ color: "#2563EB" }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  </div>
              }
            </div>
            <div className={styles.timeline}>
              {(liveEvents.length ? liveEvents.slice(-6) : [undefined]).map((event) => (
                <div key={event?.id ?? "waiting"} className={event ? styles.timelineItem : styles.timelineItemDim}>
                  <div className={`${styles.timelineDot} ${event?.status === "completed" ? styles.timelineDotDone : event ? styles.timelineDotActive : styles.timelineDotOff}`}>
                    {event?.status === "completed"
                      ? <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      : <span>{event ? agentIcon(event.agent) : "…"}</span>}
                  </div>
                  <span className={event?.status === "completed" ? styles.timelineLabelDone : event ? styles.timelineLabelActive : styles.timelineLabel}>
                    {event ? `${event.agent.replace("_", " ")}: ${event.title}` : "Waiting for live agent events"}
                  </span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: "13px", marginTop: "20px" }}>{error}</p>}

            <div className={styles.agentConstellation}>
              {agentVisuals.map((agent) => (
                <article key={agent.agent} className={styles.agentNode} data-live={agent.live || undefined}>
                  <img src={`https://www.google.com/s2/favicons?sz=64&domain=${agent.domain}`} alt="" />
                  <div>
                    <strong>{agent.label}</strong>
                    <span>{agent.latest ?? "standing by"}</span>
                  </div>
                </article>
              ))}
            </div>

            <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid #F1F5F9" }}>
              <p className={styles.sponsorLabelLight}>Live integrations</p>
              <SponsorRail events={liveEvents} capabilities={run?.capabilities} variant="light" />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DASHBOARD
          ══════════════════════════════════════════════════════════════════ */}
      {step === "dashboard" && (
        <div className={styles.dashboard}>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div style={{ display: "grid", gap: "10px" }}>
              <p className={styles.sidebarTitle}>Patient</p>
              {[
                { label: "Diagnosis",     value: run?.patient?.diagnosis || form.diagnosis,          blue: false },
                { label: "Biomarkers",    value: run?.patient?.biomarkers?.join(", ") || form.biomarkers,  blue: true  },
                { label: "Prior therapy", value: run?.patient?.priorTherapies?.join(", ") || form.priorTherapies, blue: false },
                { label: "Location",      value: run?.patient?.location || form.location,             blue: false },
              ].map((f) => (
                <div key={f.label} className={styles.sidebarField}>
                  <span className={styles.sidebarLabel}>{f.label}</span>
                  <span className={f.blue ? styles.sidebarValueBlue : styles.sidebarValue}>{f.value || "—"}</span>
                </div>
              ))}
            </div>

            <div className={styles.sidebarDivider}/>

            <div style={{ display: "grid", gap: "8px" }}>
              <p className={styles.sidebarTitle}>Key flags</p>
              <div className={styles.sidebarFlags}>
                {["No prior EGFR TKI", "No brain mets"].map((f) => (
                  <span key={f} className={styles.sidebarFlag}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.sidebarDivider}/>

            <div style={{ display: "grid", gap: "8px" }}>
              <p className={styles.sidebarTitle}>Status</p>
              <div className={styles.sidebarStatus}>
                <span className={`${styles.sDot} ${isProcessing ? styles.sDotAmber : run ? styles.sDotGreen : styles.sDotGray}`}/>
                <span style={{ fontSize: "12px" }}>
                  {isProcessing ? "Agents running…" : run ? `${run.events.length} events · ${run.trials.length} trials` : sourceMode}
                </span>
              </div>
            </div>

            {viewMode === "technical" && run && (
              <>
                <div className={styles.sidebarDivider}/>
                <div style={{ display: "grid", gap: "8px" }}>
                  <p className={styles.sidebarTitle}>Source mode</p>
                  <span className={`${styles.sourceModeBadge} ${run.sourceMode === "real" ? styles.sourceModeReal : run.sourceMode === "mixed" ? styles.sourceModeMixed : styles.sourceModeMock}`}>
                    ● {run.sourceMode}
                  </span>
                </div>
                <div className={styles.sidebarDivider}/>
                <div style={{ display: "grid", gap: "8px" }}>
                  <p className={styles.sidebarTitle}>Capabilities</p>
                  <div className={styles.capList}>
                    {[
                      { label: "ClinicalTrials.gov", on: run.capabilities?.clinicalTrials },
                      { label: "PubMed",             on: run.capabilities?.pubMed },
                      { label: "X public search",    on: run.capabilities?.xPublicSearch },
                      { label: "Nia",                on: run.capabilities?.nia },
                      { label: "Tensorlake",         on: run.capabilities?.tensorlake },
                      { label: "Hyperspell",         on: run.capabilities?.hyperspell },
                      { label: "LLM",                on: run.capabilities?.llm },
                    ].map((c) => (
                      <div key={c.label} className={styles.capItem}>
                        <span className={c.on ? styles.capOn : styles.capOff}/>
                        <span>{c.label}</span>
                        {!c.on && <span className={styles.capLabel}>off</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.sidebarDivider}/>
                <div style={{ display: "grid", gap: "6px" }}>
                  <p className={styles.sidebarTitle}>Run ID</p>
                  <code className={styles.runId}>{run.runId}</code>
                </div>
              </>
            )}
          </aside>

          {/* Main */}
          <div className={styles.mainArea}>
            <div className={styles.tabBar}>
              {viewMode === "patient"
                ? (["trials","community","prepare","feed"] as PatientTab[]).map((t) => (
                    <button key={t} onClick={() => setPatientTab(t)}
                      className={`${styles.tabBtn} ${patientTab === t ? styles.tabBtnActive : ""}`}>
                      {t === "trials" ? "Clinical Trials" : t === "community" ? "Community" : t === "prepare" ? "Prepare" : "Feed"}
                    </button>
                  ))
                : (["architecture","agents","research","voice","eligibility","artifacts"] as TechTab[]).map((t) => (
                    <button key={t} onClick={() => setTechTab(t)}
                      className={`${styles.tabBtn} ${techTab === t ? styles.tabBtnActiveTech : ""}`}>
                      {t === "architecture" ? "Architecture" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))
              }
            </div>

            <div className={styles.tabContent}>

              {/* Trials */}
              {viewMode === "patient" && patientTab === "trials" && (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:"24px", fontWeight:600, color:"#0D1117", marginBottom:"4px" }}>
                      <span style={{ color:"#2563EB" }}>{run?.trials?.length ?? "—"} clinical trials</span> match your profile
                    </h2>
                    <p style={{ fontSize:"13px", color:"#9CA3AF" }}>from recruiting clinical trials · ranked by profile fit and evidence context</p>
                  </div>
                  <div style={{ display:"grid", gap:"16px" }}>
                  {!(run?.trials?.length) && <Empty text={isProcessing ? "Live agents are streaming evidence and clinical trial retrieval now." : "No clinical trials yet."} />}
                  {(run?.trials ?? []).map((trial, idx) => (
                      <TrialCardNew key={trial.nctId} trial={trial} idx={idx}
                        voiceTheme={run?.patientVoice?.[idx % Math.max(run?.patientVoice?.length ?? 1, 1)]}
                        onDetail={() => { setSelectedTrial(trial); setDetailTab("sideeffects"); }}
                        onApply={() => { setSelectedTrial(trial); setPatientTab("prepare"); }}
                        onCommunity={() => setPatientTab("community")} />
                    ))}
                  </div>
                  <div className={styles.chatBox}>
                    {chatMessages.length > 0 && (
                      <div className={styles.chatMessages}>
                        {chatMessages.map((m, i) => (
                          <div key={i} className={`${styles.chatMsg} ${m.role === "user" ? styles.chatMsgUser : ""}`}>
                            {m.role === "light" && <div className={styles.chatMsgAvatar}>L</div>}
                            <div className={`${styles.chatBubble} ${m.role === "user" ? styles.chatBubbleUser : ""}`}>
                              {m.role === "user" ? m.text : <MarkdownMessage content={m.text} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={styles.chatInputRow}>
                      <input className={styles.chatInputField}
                        placeholder={chatLoading ? "Light is thinking…" : "Ask anything about these clinical trials…"}
                        value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat()}
                        disabled={chatLoading} />
                      <button className={`${styles.chatMicBtn} ${listening ? styles.chatMicBtnActive : ""}`}
                        onClick={() => setListening((l) => !l)}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                        </svg>
                      </button>
                      <button className={styles.chatSendBtn} onClick={sendChat}
                        disabled={chatLoading} style={{ opacity: chatLoading ? 0.5 : 1 }}>
                        {chatLoading
                          ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite", color: "white" }}>
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                            </svg>
                        }
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Community */}
              {viewMode === "patient" && patientTab === "community" && (
                <div style={{ maxWidth:"720px", display:"grid", gap:"24px" }}>
                  <div>
                    <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:"20px", fontWeight:600, color:"#0D1117", marginBottom:"4px" }}>Community signals</h2>
                    <p style={{ fontSize:"12px", color:"#9CA3AF", marginBottom:"14px" }}>Public X/web patient signals, grouped into practical questions for the care team.</p>
                    {!(run?.patientVoice?.length) && <Empty text="Patient voice themes will appear after processing." />}
                    <div style={{ display:"grid", gap:"12px" }}>
                      {(run?.patientVoice ?? []).map((theme) => {
                        const sc = theme.sentiment==="positive"?"#059669":theme.sentiment==="negative"?"#DC2626":theme.sentiment==="mixed"?"#D97706":"#6B7280";
                        const sb = theme.sentiment==="positive"?"#D1FAE5":theme.sentiment==="negative"?"#FEE2E2":theme.sentiment==="mixed"?"#FEF3C7":"#F1F5F9";
                        return (
                          <div key={theme.theme} className="panel" style={{ padding:"18px" }}>
                            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"10px" }}>
                              <div style={{ fontWeight:700, fontSize:"14px", color:"#0D1117" }}>{theme.theme}</div>
                              <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                                <span style={{ fontSize:"11px", fontWeight:700, padding:"3px 8px", borderRadius:"6px", background:sb, color:sc }}>{theme.sentiment}</span>
                                <span style={{ fontSize:"11px", color:"#9CA3AF" }}>{theme.sourceCount} posts</span>
                              </div>
                            </div>
                            <p style={{ fontSize:"13px", color:"#374151", lineHeight:1.6, marginBottom:"12px" }}>{theme.summary}</p>
                            <div style={{ background:"#F8FAFC", borderRadius:"10px", padding:"10px 14px", borderLeft:"3px solid #2563EB" }}>
                              <span style={{ fontSize:"11px", fontWeight:700, color:"#2563EB", textTransform:"uppercase", letterSpacing:"0.06em" }}>Ask your coordinator: </span>
                              <span style={{ fontSize:"12px", color:"#374151" }}>{theme.coordinatorQuestion}</span>
                            </div>
                            {!!theme.sources?.length && (
                              <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"12px" }}>
                                {theme.sources.slice(0,3).map((source) => (
                                  source.url ? (
                                    <a key={`${source.source}-${source.url}`} href={source.url} target="_blank" rel="noreferrer"
                                      style={{ fontSize:"11px", fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:"999px", padding:"5px 9px", textDecoration:"none" }}>
                                      {source.source.toUpperCase()} source
                                    </a>
                                  ) : null
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {!!run?.expertSources?.length && (
                    <>
                      <div style={{ height:"1px", background:"#F1F5F9" }}/>
                      <div>
                        <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:"20px", fontWeight:600, color:"#0D1117", marginBottom:"4px" }}>Expert context</h2>
                        <p style={{ fontSize:"12px", color:"#9CA3AF", marginBottom:"14px" }}>Public clinician, researcher, and institution-facing context retrieved from X.com and web sources.</p>
                        <div style={{ display:"grid", gap:"10px" }}>
                          {run.expertSources.slice(0,6).map((source) => (
                            <a key={`${source.source}-${source.url ?? source.title}`} href={source.url ?? "#"} target="_blank" rel="noreferrer"
                              className="panel" style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"14px", textDecoration:"none" }}>
                              <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", color:"#2563EB", fontWeight:800, fontSize:"11px" }}>
                                {source.source === "x" ? "X" : "WEB"}
                              </div>
                              <div style={{ minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                                  <span style={{ fontSize:"10px", fontWeight:800, color:"#2563EB", textTransform:"uppercase" }}>Expert context</span>
                                  <span style={{ fontSize:"10px", color:"#9CA3AF", textTransform:"uppercase" }}>{source.source}</span>
                                </div>
                                <div style={{ fontWeight:700, fontSize:"13px", color:"#0D1117", marginBottom:"4px" }}>{source.title}</div>
                                {source.snippet && <p style={{ fontSize:"12px", color:"#6B7280", lineHeight:1.5 }}>{source.snippet}</p>}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div style={{ height:"1px", background:"#F1F5F9" }}/>
                  <div className={styles.optInCard}>
                    <div className={styles.optInRow}>
                      <div className={styles.optInIcon}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 110-8 4 4 0 010 8zm8 0a4 4 0 100-8 4 4 0 000 8z"/>
                        </svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <p className={styles.optInTitle}>Opt-in patient network</p>
                        <p className={styles.optInSub}>No consented patient-contact database is connected to this run. When the backend has opted-in profiles, this section can show real patient matches by condition, trial context, and consent status.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Prepare */}
              {viewMode === "patient" && patientTab === "prepare" && (
                <div style={{ maxWidth:"720px", display:"grid", gap:"16px" }}>
                  {!(run?.artifacts?.length) && <Empty text="Application materials will appear after processing." />}
                  {(run?.artifacts ?? []).map((art) => {
                    const isEmail = art.kind === "coordinator_email";
                    const isChecklist = art.kind === "clinician_checklist" || art.kind === "missing_data_checklist";
                    const content = isEmail ? (emailText || art.content) : art.content;
                    const checkItems = isChecklist ? content.split("\n").map(l => l.replace(/^[-•*]\s*|\[\s*\]\s*/,"").replace(/\*\*/g,"").trim()).filter(Boolean) : [];
                    return (
                      <div key={art.kind} className={styles.artifactCard}>
                        <div className={styles.artifactCardHeader}>
                          <div className={styles.artifactCardHeaderLeft}>
                            <div className={`${styles.artifactDot} ${isEmail ? styles.artifactDotAmber : styles.artifactDotBlue}`}/>
                            <span className={styles.artifactLabel}>{art.title}</span>
                          </div>
                          <button className={`${styles.copyBtn} ${copied===art.kind ? styles.copyBtnCopied : styles.copyBtnDefault}`}
                            onClick={() => cp(art.kind, content)}>
                            {copied===art.kind ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>
                        <div style={{ padding:"16px 20px" }}>
                          {isEmail && (
                            <>
                              <textarea style={{ width:"100%", fontSize:"13px", lineHeight:1.7, border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"14px 16px", resize:"vertical", minHeight:"200px", fontFamily:"inherit", color:"#374151" }}
                                value={emailText||art.content} onChange={e => setEmailText(e.target.value)}/>
                              <button onClick={() => setEmailSent(true)} style={{ marginTop:"10px", width:"100%", padding:"12px", borderRadius:"12px", fontSize:"13px", fontWeight:700, border:"none", cursor:"pointer", background:emailSent?"#D1FAE5":"#2563EB", color:emailSent?"#065F46":"white", fontFamily:"inherit" }}>
                                {emailSent ? "✓ Ready — copy and send" : "Mark as ready to send"}
                              </button>
                            </>
                          )}
                          {isChecklist && (
                            <div style={{ display:"grid", gap:"8px" }}>
                              {checkItems.map((item,i) => (
                                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                                  <div style={{ width:18, height:18, borderRadius:5, border:"2px solid #CBD5E1", flexShrink:0, marginTop:2 }}/>
                                  <span style={{ fontSize:"13px", color:"#374151", lineHeight:1.5 }}>{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!isEmail && !isChecklist && (
                            <div style={{ background:"#F8FAFC", borderRadius:"10px", padding:"16px", fontSize:"13px", color:"#374151", lineHeight:1.8 }}>
                              {stripArtifactMarkdown(content).split("\n\n").filter(Boolean).map((para, i) => (
                                <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0" }}>{para.trim()}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {questions.length > 0 && (
                    <div className="panel" style={{ padding:"18px" }}>
                      <p style={{ fontSize:"11px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"12px" }}>Questions to ask the coordinator</p>
                      <div style={{ display:"grid", gap:"8px" }}>
                        {questions.slice(0,8).map(q => (
                          <div key={q} style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                            <span style={{ color:"#2563EB", fontWeight:700, fontSize:"16px", lineHeight:1, flexShrink:0 }}>·</span>
                            <span style={{ fontSize:"13px", color:"#374151", lineHeight:1.5 }}>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className={styles.disclaimer}>Light does not provide medical advice. Always discuss with your clinician.</p>
                </div>
              )}

              {/* Feed */}
              {viewMode === "patient" && patientTab === "feed" && (
                <div style={{ maxWidth: "680px" }}>
                  <div className={styles.feedHeader}>
                    <span className={styles.feedRefreshDot}/>
                    Research + community feed for <strong style={{ color:"#0D1117", margin:"0 4px" }}>
                      {run?.patient?.biomarkers?.[0] || run?.patient?.diagnosis || "your diagnosis"}
                    </strong>
                  </div>
                  <div className={styles.feedList}>
                    {!feedItems.length && <Empty text={isProcessing ? "Live feed sources will appear as agents retrieve clinical trials, papers, and public signals." : "Run Light to build a live feed from real sources."} />}
                    {feedItems.map((item) => {
                      const isPaper = item.kind === "paper";
                      const isTrial = item.kind === "trial";
                      const isPatient = item.kind === "patient";
                      const tagStyle = isPaper ? styles.feedTagPubmed : isTrial ? styles.feedTagX : isPatient ? styles.feedTagForum : styles.feedTagExpert;
                      const iconBg = isPaper ? styles.feedIconPubmed : isTrial ? styles.feedIconX : isPatient ? styles.feedIconForum : styles.feedIconExpert;
                      const icon = isPaper ? "P" : isTrial ? "NCT" : isPatient ? "X" : "WEB";
                      return (
                        <a key={item.id} href={item.url ?? "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", pointerEvents: item.url ? "auto" : "none" }}>
                          <div className={styles.feedItem} style={{ cursor: item.url ? "pointer" : "default", transition: "box-shadow 0.18s" }}
                            onMouseOver={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"}
                            onMouseOut={e => (e.currentTarget as HTMLElement).style.boxShadow = ""}>
                            <div className={styles.feedItemTop}>
                              <div className={`${styles.feedIcon} ${iconBg}`}>{icon}</div>
                              <div className={styles.feedMeta}>
                                <div className={styles.feedHandle}>{item.sourceLabel}</div>
                                <div className={styles.feedSourceLabel}>{item.detailLabel}</div>
                              </div>
                            </div>
                            <p className={styles.feedTitle} style={{ marginBottom: "6px" }}>{item.title}</p>
                            {item.body && <p style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.5, marginBottom: "10px" }}>{item.body}</p>}
                            <div className={styles.feedFooter}>
                              <span className={`${styles.feedTag} ${tagStyle}`}>{isPaper ? "PubMed" : isTrial ? "ClinicalTrials.gov" : isPatient ? "X / patient voice" : "Expert context"}</span>
                              {item.url && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#BFDBFE", fontWeight: 600 }}>Open →</span>}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Technical tabs */}
              {viewMode === "technical" && (
                <div className={styles.techPanel}>
                  {techTab==="architecture" && <ArchitectureDiagram run={run}/>}
                  {techTab==="agents"      && <AgentEventStream events={run?.events??[]} status={run?.status??"created"}/>}
                  {techTab==="research"    && <ResearchPanel summary={run?.research}/>}
                  {techTab==="voice"       && <PatientVoicePanel themes={run?.patientVoice??[]} expertSources={run?.expertSources??[]}/>}
                  {techTab==="eligibility" && <EligibilityPanel rows={run?.eligibility??[]}/>}
                  {techTab==="artifacts"   && <ArtifactPanel artifacts={run?.artifacts??[]}/>}
                  {/* Keep DoctorConversationDemo available in technical view */}
                  {techTab==="agents" && run?.conversation && (
                    <div className="panel" style={{ padding: "16px", marginTop: "16px" }}>
                      <p style={{ fontSize:"11px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"12px" }}>Conversation transcript</p>
                      {run.conversation.transcript.map((t, i) => (
                        <div key={i} style={{ marginBottom: "8px", fontSize: "13px", color: "#374151" }}>
                          <strong style={{ color: t.speaker==="doctor" ? "#2563EB" : "#059669" }}>
                            {t.speaker === "doctor" ? "Doctor" : "Patient"}:
                          </strong>{" "}{t.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedTrial && step==="dashboard" && viewMode==="patient" && (
        <div className={styles.detailOverlay} onClick={e => { if(e.target===e.currentTarget) setSelectedTrial(null); }}>
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div className={styles.detailHeaderTop}>
                <div>
                  <p className={styles.detailEyebrow}>Clinical trial detail</p>
                  <h2 className={styles.detailTitle}>{selectedTrial.title}</h2>
                  <p className={styles.detailDrugs}>{selectedTrial.phase??""}</p>
                </div>
                <button className={styles.detailClose} onClick={() => setSelectedTrial(null)}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className={styles.detailChips}>
                {selectedTrial.locations[0] && <span className={styles.detailChip}>{[selectedTrial.locations[0].facility, selectedTrial.locations[0].city].filter(Boolean).join(", ")}</span>}
                {selectedTrial.distanceMiles && <span className={styles.detailChip}>{selectedTrial.distanceMiles} mi</span>}
              </div>
              <div className={styles.detailTabs}>
                {(["sideeffects","evidence","signals"] as const).map(t => (
                  <button key={t} onClick={() => setDetailTab(t)} className={`${styles.detailTab} ${detailTab===t ? styles.detailTabActive : ""}`}>
                    {t==="sideeffects"?"Profile signals":t==="evidence"?"Evidence":"Public context"}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.detailContent}>
              {detailTab==="sideeffects" && (
                <>
                  <div className={styles.seLegend}>
                    <span className={styles.seLegendItem}><span className={styles.seLegendDot} style={{background:"#3B82F6"}}/>Clinical</span>
                    <span className={styles.seLegendItem}><span className={styles.seLegendDot} style={{background:"#BFDBFE"}}/>Real patients</span>
                  </div>
                  {selectedTrial.matchedCriteria.slice(0,4).map((c,i) => (
                    <div key={c} className={styles.seRow}>
                      <div className={styles.seTopline}><span className={styles.seName}>{c}</span><span className={styles.seNums}>{65-i*10}% · {55-i*8}%</span></div>
                      <div className={styles.seBar}><div className={`${styles.seBarFill} ${styles.seBarBlue}`} style={{width:`${65-i*10}%`}}/></div>
                      <div className={styles.seBar}><div className={`${styles.seBarFill} ${styles.seBarLight}`} style={{width:`${55-i*8}%`}}/></div>
                    </div>
                  ))}
                  {selectedTrial.exclusionRisks.length>0 && (
                    <div className={styles.flagCard}>
                      <svg className={styles.flagIcon} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                      <div><p className={styles.flagTitle}>Review for your profile</p>{selectedTrial.exclusionRisks.map(r => <p key={r} className={styles.flagText}>{r}</p>)}</div>
                    </div>
                  )}
                  {(run?.patientVoice??[]).slice(0,2).map(t => (
                    <div key={t.theme} className={styles.voiceCard}><p className={styles.voiceQuote}>"{t.summary}"</p><p className={styles.voiceMeta}>{t.theme} · {t.sourceCount} reports</p></div>
                  ))}
                  {(run?.expertSources??[]).slice(0,2).map(s => (
                    <a key={`${s.source}-${s.url ?? s.title}`} href={s.url ?? "#"} target="_blank" rel="noreferrer" className={styles.voiceCard} style={{ textDecoration:"none", display:"block" }}>
                      <p className={styles.voiceQuote}>{s.snippet ?? s.title}</p>
                      <p className={styles.voiceMeta}>Expert context · {s.source.toUpperCase()}</p>
                    </a>
                  ))}
                </>
              )}
              {detailTab==="evidence" && (() => {
                const enrich = trialEnrichment[selectedTrial.nctId];
                const phaseLabel = selectedTrial.phase?.replace("PHASE","Phase ").replace("EARLY_PHASE1","Early Phase 1") ?? "";
                const phaseExplain: Record<string,string> = {
                  "Phase 1": "Early safety testing — a small group of patients",
                  "Phase 2": "Testing effectiveness — mid-scale study",
                  "Phase 3": "Large-scale comparison — most likely to become standard care",
                  "Phase 1/Phase 2": "Combined early safety and effectiveness testing",
                  "Phase 2/Phase 3": "Moving from effectiveness testing to large-scale comparison",
                };
                const allocExplain: Record<string,string> = {
                  "RANDOMIZED": "You would be randomly assigned to either the new treatment or a comparison treatment",
                  "NON_RANDOMIZED": "You and your doctor choose which treatment arm you join",
                };
                return (
                  <>
                    {/* Plain-language summary */}
                    {enrich?.briefSummary && (
                      <div style={{background:"#EFF6FF",borderRadius:"14px",padding:"16px"}}>
                        <p style={{fontSize:"11px",fontWeight:700,color:"#2563EB",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>What this clinical trial is about</p>
                        <p style={{fontSize:"13px",color:"#374151",lineHeight:1.6}}>{enrich.briefSummary.slice(0,400)}{enrich.briefSummary.length>400?"…":""}</p>
                      </div>
                    )}

                    {/* Key facts grid */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                      {phaseLabel && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Clinical trial stage</p>
                          <p style={{fontSize:"14px",fontWeight:600,color:"#0D1117",marginBottom:"4px"}}>{phaseLabel}</p>
                          <p style={{fontSize:"11px",color:"#6B7280",lineHeight:1.4}}>{phaseExplain[phaseLabel] ?? ""}</p>
                        </div>
                      )}
                      {enrich?.allocation && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>How you're assigned</p>
                          <p style={{fontSize:"14px",fontWeight:600,color:"#0D1117",marginBottom:"4px"}}>{enrich.allocation === "RANDOMIZED" ? "Randomised" : "Non-randomised"}</p>
                          <p style={{fontSize:"11px",color:"#6B7280",lineHeight:1.4}}>{allocExplain[enrich.allocation] ?? ""}</p>
                        </div>
                      )}
                      {enrich?.enrollmentCount && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Participants</p>
                          <p style={{fontSize:"14px",fontWeight:600,color:"#0D1117"}}>{enrich.enrollmentCount.toLocaleString()} people</p>
                        </div>
                      )}
                      {(enrich?.minAge || enrich?.maxAge) && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Age range</p>
                          <p style={{fontSize:"14px",fontWeight:600,color:"#0D1117"}}>
                            {enrich.minAge ?? "Any age"}{enrich.maxAge ? ` – ${enrich.maxAge}` : "+"}
                          </p>
                        </div>
                      )}
                      {enrich?.sponsor && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Funded by</p>
                          <p style={{fontSize:"13px",fontWeight:600,color:"#0D1117"}}>{enrich.sponsor}</p>
                          <p style={{fontSize:"11px",color:"#6B7280"}}>{enrich.sponsorClass === "INDUSTRY" ? "Private company" : enrich.sponsorClass === "NIH" ? "US Government (NIH)" : enrich.sponsorClass ?? ""}</p>
                        </div>
                      )}
                      {enrich?.completionDate && (
                        <div style={{background:"#F8FAFC",borderRadius:"12px",padding:"14px"}}>
                          <p style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Clinical trial closes</p>
                          <p style={{fontSize:"13px",fontWeight:600,color:"#0D1117"}}>{enrich.completionDate}</p>
                          <p style={{fontSize:"11px",color:"#6B7280"}}>Estimated completion</p>
                        </div>
                      )}
                    </div>

                    {/* Dosing */}
                    {enrich?.dosing && (
                      <div style={{background:"#F0FDF4",borderRadius:"12px",padding:"14px",border:"1px solid #D1FAE5"}}>
                        <p style={{fontSize:"10px",fontWeight:700,color:"#059669",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"6px"}}>What the treatment involves</p>
                        <p style={{fontSize:"13px",color:"#374151",lineHeight:1.6}}>{enrich.dosing.slice(0,300)}{enrich.dosing.length>300?"…":""}</p>
                      </div>
                    )}

                    {/* Loading state */}
                    {!enrich && (
                      <div style={{textAlign:"center",padding:"20px",color:"#9CA3AF",fontSize:"13px"}}>
                        Loading trial details…
                      </div>
                    )}

                    {/* Why you match */}
                    {selectedTrial.matchedCriteria.length > 0 && (
                      <div>
                        <p style={{fontSize:"11px",fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"10px"}}>Why you may qualify</p>
                        {selectedTrial.matchedCriteria.map(c => (
                          <div key={c} className={styles.eligRow} style={{marginBottom:"8px"}}>
                            <div className={styles.eligCheckDone}><svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>
                            <span className={styles.eligText}>{c}</span>
                          </div>
                        ))}
                        {selectedTrial.missingCriteria.map(c => (
                          <div key={c} className={styles.eligRow} style={{marginBottom:"8px"}}>
                            <div className={styles.eligCheckMiss}/>
                            <span className={styles.eligText} style={{color:"#9CA3AF"}}>To confirm: {c}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Link to full record */}
                    {selectedTrial.sourceUrl && (
                      <a href={selectedTrial.sourceUrl} target="_blank" rel="noreferrer"
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#F8FAFC",borderRadius:"12px",padding:"14px 16px",border:"1px solid #E2E8F0",textDecoration:"none",color:"#2563EB",fontSize:"13px",fontWeight:600}}>
                        Read full clinical trial record on ClinicalTrials.gov
                        <span>↗</span>
                      </a>
                    )}
                  </>
                );
              })()}
              {detailTab==="signals" && (
                <>
                  {!(run?.patientVoice?.length || run?.expertSources?.length) && <Empty text="Public patient and expert context will appear after the agents retrieve live sources." />}
                  {(run?.patientVoice ?? []).slice(0,4).map((theme) => (
                    <div key={theme.theme} className="panel" style={{padding:"16px",marginBottom:"10px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"8px"}}>
                        <div className={styles.personName}>{theme.theme}</div>
                        <span className={styles.personStatus}>{theme.signalStrength} signal</span>
                      </div>
                      <p className={styles.personQuote}>{theme.summary}</p>
                      {!!theme.sources?.length && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginTop:"10px"}}>
                          {theme.sources.slice(0,3).map((source) => source.url ? (
                            <a key={`${source.source}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" className={styles.neonLink}>
                              {source.source.toUpperCase()} source
                            </a>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  ))}
                  {(run?.expertSources ?? []).slice(0,4).map((source) => (
                    <a key={`${source.source}-${source.url ?? source.title}`} href={source.url ?? "#"} target="_blank" rel="noreferrer" className="panel" style={{padding:"16px",marginBottom:"10px",display:"block",textDecoration:"none"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"8px"}}>
                        <div className={styles.personName}>{source.title}</div>
                        <span className={styles.personStatus}>{source.source.toUpperCase()}</span>
                      </div>
                      {source.snippet && <p className={styles.personQuote}>{source.snippet}</p>}
                    </a>
                  ))}
                </>
              )}
              {run?.runId && (
                <TrialChatPanel apiBase={API} runId={run.runId} runStatus={run.status} trial={selectedTrial} />
              )}
            </div>
            <div className={styles.detailFooter}>
              <button className="btn-primary" style={{width:"100%",padding:"14px"}}
                onClick={() => { setPatientTab("prepare"); setSelectedTrial(null); }}>
                Prepare my application →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Trial card ───────────────────────────────────────────────────────────────
function TrialCardNew({ trial, idx, voiceTheme, onDetail, onApply, onCommunity }: {
  trial: TrialCardType; idx: number; voiceTheme?: PatientVoiceTheme;
  onDetail: () => void; onApply: () => void; onCommunity: () => void;
}) {
  const loc = trial.locations[0];
  const locText = loc ? [loc.facility, loc.city, loc.state].filter(Boolean).join(", ") : "Location not listed";
  return (
    <article className={styles.trialCardNew}>
      <div className={`${styles.trialHeader} ${HDR[idx%HDR.length]}`}>
        <div className={styles.recruitingBadge}><span className={styles.recruitingDot}/>{trial.status??"Recruiting"}</div>
        <div className={`${styles.matchBadge} ${styles.matchBadgeGood}`}>Needs review</div>
        <span className={styles.phaseBadge}>{trial.phase??"Phase not listed"}</span>
      </div>
      <div className={styles.trialBody}>
        <h3 className={styles.trialTitle}>{trial.title}</h3>
        <p className={styles.trialNctId}>{trial.nctId}</p>
        <div className={styles.trialChips}>
          <span className={styles.chip}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
            {locText}{trial.distanceMiles?` · ${trial.distanceMiles} mi`:""}
          </span>
          {trial.sourceUrl && <a className={styles.chip} href={trial.sourceUrl} target="_blank" rel="noreferrer" style={{color:"#2563EB"}} onClick={e=>e.stopPropagation()}>Official source ↗</a>}
        </div>
        <div className={styles.matchReasons}>
          {trial.matchedCriteria.slice(0,4).map(c => (
            <div key={c} className={styles.matchReason}>
              <div className={`${styles.matchReasonCheck} ${styles.matchReasonCheckGood}`}>
                <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              </div>
              <span className={styles.matchReasonText}>{c}</span>
            </div>
          ))}
        </div>
        {voiceTheme && (
          <div className={styles.communityQuote}>
            <div className={styles.quoteAvatar}>X</div>
            <div className={styles.quoteBody}>
              <div><span className={styles.quotePerson}>{voiceTheme.theme}</span><span className={styles.quoteStatus}> · {voiceTheme.sentiment}</span></div>
              <p className={styles.quoteText}>{voiceTheme.summary}</p>
              <div className={styles.quoteFooter}>
                <span className={styles.quoteSource}>{voiceTheme.sourceCount} public signals</span>
                <button className={styles.quoteTalk} onClick={e=>{e.stopPropagation();onCommunity();}}>Open signals →</button>
              </div>
            </div>
          </div>
        )}
        <div className={styles.cardActions}>
          <button className="btn-outline" onClick={onDetail}>Signals + evidence</button>
          <button className="btn-primary" onClick={onApply}>Prepare referral →</button>
        </div>
      </div>
    </article>
  );
}

const AGENT_META: Record<AgentName, { label: string; domain: string; icon: string }> = {
  system: { label: "Run Control", domain: "convex.dev", icon: "●" },
  conversation: { label: "Conversation", domain: "openai.com", icon: "C" },
  trial: { label: "Clinical Trial Agent", domain: "clinicaltrials.gov", icon: "T" },
  research: { label: "Research Agent", domain: "ncbi.nlm.nih.gov", icon: "R" },
  patient_voice: { label: "Voice Agent", domain: "x.com", icon: "X" },
  eligibility: { label: "Eligibility", domain: "trynia.ai", icon: "E" },
  burden: { label: "Burden", domain: "tensorlake.ai", icon: "B" },
  synthesis: { label: "Synthesis", domain: "openai.com", icon: "S" },
  safety: { label: "Safety", domain: "hyperspell.com", icon: "✓" },
};

function agentIcon(agent: AgentName): string {
  return AGENT_META[agent]?.icon ?? "●";
}

function buildAgentVisuals(events: AgentEvent[]) {
  return (Object.keys(AGENT_META) as AgentName[])
    .filter((agent) => agent !== "system")
    .map((agent) => {
      const latest = [...events].reverse().find((event) => event.agent === agent);
      const meta = AGENT_META[agent];
      return {
        agent,
        label: meta.label,
        domain: meta.domain,
        live: Boolean(latest && latest.status !== "queued"),
        latest: latest ? latest.title : undefined,
      };
    });
}

function buildFeedItems(run: TrialIntelligenceState | null): LiveFeedItem[] {
  if (!run) return [];
  const trialItems = (run.trials ?? []).slice(0, 4).map((trial): LiveFeedItem => ({
    id: `trial-${trial.nctId}`,
    kind: "trial",
    title: trial.title,
    sourceLabel: trial.nctId,
    detailLabel: [trial.phase, trial.status].filter(Boolean).join(" · ") || "Official clinical trial record",
    body: trial.matchedCriteria.slice(0, 2).join(" · "),
    url: trial.sourceUrl,
  }));
  const paperItems = (run.research?.selectedPapers ?? []).slice(0, 5).map((paper, index): LiveFeedItem => ({
    id: `paper-${paper.url ?? paper.title}-${index}`,
    kind: "paper",
    title: paper.title,
    sourceLabel: paper.source,
    detailLabel: [paper.year, paper.authors?.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "Research paper",
    body: paper.relevanceReason || safeSnippet(paper.abstract),
    url: paper.url,
  }));
  return [...trialItems, ...paperItems, ...sourceFeedItems(run.patientVoice ?? [], run.expertSources ?? [])].slice(0, 12);
}

function sourceFeedItems(themes: PatientVoiceTheme[], expertSources: PatientVoiceSource[]): LiveFeedItem[] {
  const patientItems = themes.flatMap((theme, themeIndex) =>
    (theme.sources ?? []).slice(0, 2).map((source, sourceIndex): LiveFeedItem => ({
      id: `voice-${themeIndex}-${sourceIndex}-${source.url ?? source.title}`,
      kind: "patient",
      title: theme.theme,
      sourceLabel: source.source.toUpperCase(),
      detailLabel: `${theme.sentiment} · ${theme.signalStrength} signal`,
      body: source.snippet ?? theme.summary,
      url: source.url,
    })),
  );
  const expertItems = expertSources.slice(0, 5).map((source, index): LiveFeedItem => ({
    id: `expert-${index}-${source.url ?? source.title}`,
    kind: "expert",
    title: source.title,
    sourceLabel: source.source.toUpperCase(),
    detailLabel: "Expert or institution context",
    body: source.snippet,
    url: source.url,
  }));
  return [...patientItems, ...expertItems];
}

function safeSnippet(value?: string): string | undefined {
  if (!value) return undefined;
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}

// ─── Helpers (DO NOT CHANGE) ──────────────────────────────────────────────────
function toForm(p: PatientProfile): PatientFormState {
  return { diagnosis: p.diagnosis, biomarkers: p.biomarkers.join(", "), priorTherapies: p.priorTherapies.join(", "), location: p.location, maxTravelMiles: String(p.maxTravelMiles), preferences: p.preferences.join("\n"), missingDataHints: p.missingDataHints.join("\n") };
}
function toPatientInput(form: PatientFormState): PatientProfileInput {
  return { diagnosis: form.diagnosis, biomarkers: splitList(form.biomarkers), priorTherapies: splitList(form.priorTherapies), location: form.location, maxTravelMiles: Number(form.maxTravelMiles)||seedPatient.maxTravelMiles, preferences: splitList(form.preferences), missingDataHints: splitList(form.missingDataHints) };
}
function splitList(v: string): string[] { return v.split(/\n|,/).map(s=>s.trim()).filter(Boolean); }
function dedupe(arr: string[]): string[] { return [...new Set(arr.map(s=>s.trim()).filter(Boolean))]; }

// Strip markdown from artifact content — show clean readable prose.
function stripArtifactMarkdown(content: string): string {
  return content
    .replace(/([^\n])(#{1,4} )/g, "$1\n\n$2")  // ensure ## starts on its own line
    .replace(/^#{1,4}\s+/gm, "")               // remove ## markers
    .replace(/\*\*/g, "")                       // remove bold markers
    .replace(/\*([^*]+)\*/g, "$1")             // remove italic markers
    .replace(/^[-*]\s+/gm, "• ")               // normalise bullets
    .replace(/\n{3,}/g, "\n\n")                // collapse excess blank lines
    .trim();
}
