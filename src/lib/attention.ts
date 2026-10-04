import type { OwnerData, Question } from "./model";

/**
 * What needs the CEO, counted for the places in the office where it is dealt with. These are the same things those places list, so the
 * number on a hotspot is the number you will find when you open it:
 *   - contracts: authorizations to sign, plans awaiting a signature, and questions asked of the CEO
 *   - phone: everything pressing, the same plus anything blocked
 *   - computer: work that is blocked or failed, and projects that are waiting or held
 *   - directive: the CEO's own requests that are asking a question
 * The brief, the door and the focus lamp carry no count. Nothing here decides anything; it only counts what the API already says.
 */
export type Attention = { contracts: number; phone: number; computer: number; directive: number };

export function attentionCounts(data: OwnerData, questions: readonly Question[]): Attention {
  const toSign = data.approvals.filter((a) => a.status === "REQUESTED").length;
  const plans = data.intents.filter((i) => i.status === "PLANNED" && i.project_id).length;
  const asked = questions.filter((q) => q.routed_to === "CEO").length;
  const blocked = data.tasks.filter((t) => t.status === "BLOCKED" || t.status === "FAILED").length;
  const held = data.projects.filter((p) => p.status === "WAITING" || p.status === "PAUSED").length;
  const directives = data.intents.filter((i) => i.source === "CEO_DIRECTIVE" && i.questions.length > 0).length;
  return { contracts: toSign + plans + asked, phone: toSign + asked + blocked + directives, computer: blocked + held, directive: directives };
}

export const needYou = (n: number) => `${n} ${n === 1 ? "needs" : "need"} you`;
