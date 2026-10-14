import { frameTokens, nodesOf, paintHex, radiusPx, FONT_STACK, type DesignDocument, type SNode, type Tokens } from "./sdd";

/** Structured data out (the document itself) and preview assets out (one SVG per frame). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, width: number, size: number, family: string, weight = 400): string[] {
  const avg = size * (family === "mono" ? 0.6 : family === "serif" ? 0.46 : 0.53) * (weight >= 600 ? 1.15 : 1);
  const perLine = Math.max(4, Math.floor(width / avg));
  const lines: string[] = [];
  text.split("\n").forEach((para) => {
    let line = "";
    para.split(/\s+/).forEach((w) => {
      if ((line + " " + w).trim().length > perLine && line) { lines.push(line); line = w; } else line = (line + " " + w).trim();
    });
    lines.push(line);
  });
  return lines;
}

function nodeSvg(n: SNode, t: Tokens): string {
  const fill = paintHex(n.fill, t, "none");
  const stroke = n.stroke ? ` stroke="${paintHex(n.stroke, t)}" stroke-width="1"` : "";
  const op = n.opacity !== undefined && n.opacity < 1 ? ` opacity="${n.opacity}"` : "";
  const rx = radiusPx(n.radius, t, n.w, n.h);
  const box = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${fill}"${stroke}${op}/>`;
  if (n.kind === "image") return `<g${op}>${box}<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="none" stroke="${t.color.border}" stroke-dasharray="6 6"/><text x="${n.x + n.w / 2}" y="${n.y + n.h / 2}" text-anchor="middle" font-family="${esc(FONT_STACK.sans)}" font-size="12" fill="${t.color.textMuted}">PLACEHOLDER: ${esc(n.asset?.label ?? "image")}</text></g>`;
  if (!n.text) return box;
  const style = t.type[n.text.style];
  const family = FONT_STACK[style.family];
  const size = n.text.size ?? style.size;
  const lines = wrap(n.text.content, n.w - (n.kind === "button" ? 16 : 0), size, style.family, style.weight);
  const lh = size * style.lineHeight;
  const anchor = n.text.align === "center" ? "middle" : n.text.align === "right" ? "end" : "start";
  const x = n.text.align === "center" ? n.x + n.w / 2 : n.text.align === "right" ? n.x + n.w : n.x;
  const blockH = lines.length * lh;
  const y0 = n.kind === "button" ? n.y + (n.h - blockH) / 2 + size : n.y + size;
  const spans = lines.map((l, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join("");
  const label = `<text font-family="${esc(family)}" font-size="${size}" font-weight="${style.weight}" letter-spacing="${style.tracking}" fill="${paintHex(n.text.color, t)}" text-anchor="${anchor}">${spans}</text>`;
  return n.kind === "button" ? `<g${op}>${box}${label}</g>` : `<g${op}>${label}</g>`;
}

export function frameToSvg(d: DesignDocument, frameId: string): string {
  const f = d.frames.find((x) => x.id === frameId);
  const t = frameTokens(d, frameId);
  if (!f || !t) return "";
  const body = nodesOf(d, frameId).filter((n) => !n.hidden).map((n) => nodeSvg(n, t)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="${esc(f.name)}"><title>${esc(d.projectName)}: ${esc(f.name)}, revision ${d.revision}</title><rect width="${f.w}" height="${f.h}" fill="${t.color.surface}"/>${body}</svg>`;
}

/** The document as data. Checkpoint snapshots stay in the working copy; they are recoverable history, not part of the design. */
export function documentJson(d: DesignDocument): string {
  return JSON.stringify({ ...d, checkpoints: d.checkpoints.map((c) => ({ ...c, snapshot: "" })) }, null, 2);
}

export function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";

/** How tall a text element's words will stand when wrapped to its width: an estimate, used to tell when copy will not fit its box. */
export function textBlockHeight(n: SNode, t: Tokens): number {
  if (!n.text) return 0;
  const style = t.type[n.text.style];
  const size = n.text.size ?? style.size;
  return wrap(n.text.content, n.w - (n.kind === "button" ? 16 : 0), size, style.family, style.weight).length * size * style.lineHeight;
}
