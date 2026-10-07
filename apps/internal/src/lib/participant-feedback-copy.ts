import type { ParticipantFeedbackAspect } from "@sugt/domain";

/**
 * **Participant Feedback's words, in one place** (#446) — the form at `/f/[token]`, the Peserta tab
 * of `/feedback` and the School-detail concern chip all read them, so an Aspect is called the same
 * thing everywhere. Indonesian copy around the English domain terms (`CONTEXT.md`).
 */

/** Each Aspect's short name: the `/feedback` cards and filters, and the concern chip. */
export const PARTICIPANT_ASPECT_LABELS: Record<ParticipantFeedbackAspect, string> = {
  hands_on_rbl: "Hands-on RBL",
  materials: "Materi",
  instructor: "Narasumber",
  relevance: "Relevansi",
};

/**
 * Each Aspect as the form asks it: its label, and a one-line description under it so a Participant
 * knows what they are Rating. **The form only** — `/feedback` keeps the short labels above.
 */
export const PARTICIPANT_ASPECT_QUESTIONS: Record<
  ParticipantFeedbackAspect,
  { label: string; description: string }
> = {
  hands_on_rbl: {
    label: "Pengalaman hands-on RBL",
    description: "Apakah modul RBL yang dibuat mudah dilakukan?",
  },
  materials: {
    label: "Materi",
    description: "Apakah materi yang diberikan mudah dipahami?",
  },
  instructor: {
    label: "Narasumber",
    description: "Apakah narasumber menyampaikan materi dengan jelas?",
  },
  relevance: {
    label: "Relevansi",
    description: "Apakah materi yang diberikan relevan?",
  },
};

/**
 * The two written questions — not Aspects: no Rating — as the form asks them and as `/feedback`
 * heads their answers.
 */
export const PARTICIPANT_WRITTEN_QUESTIONS = {
  knowledgeGain: {
    question: "Melalui kegiatan kelas ini apakah meningkatkan atau menambah pengetahuan Anda?",
    heading: "Peningkatan pengetahuan",
  },
  suggestions: {
    question: "Saran dan masukan untuk kegiatan kelas",
    heading: "Saran dan masukan",
  },
} as const;
