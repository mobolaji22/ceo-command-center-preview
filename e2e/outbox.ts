import { readFileSync, existsSync } from "node:fs";

export interface Mail { to: string; subject: string; meta?: { link?: string; code?: string; kind: string } }

/** The newest "emailed" message of a kind to an address, waiting briefly for it to arrive. */
export async function mailTo(to: string, kind: string, after = 0): Promise<Mail & { n: number }> {
  const file = process.env["E2E_OUTBOX"]!;
  for (let i = 0; i < 40; i++) {
    if (existsSync(file)) {
      const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Mail);
      for (let n = lines.length - 1; n >= after; n--) {
        const m = lines[n]!;
        if (m.to === to && m.meta?.kind === kind) return { ...m, n: n + 1 };
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${kind} email to ${to}`);
}

export const mailCount = () => {
  const file = process.env["E2E_OUTBOX"]!;
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).length : 0;
};
