"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import {
  COMPETITOR_WORDS, FOUNDATION_WORDS, IMPLICATION_HEADINGS, STATUS_WORDS, STORY_PARTS, areaWords, channelWords, findingsFor, lensWords,
  type BrandBookView, type ClientBookView, type KeptBrand, type MarketReportView,
} from "@/lib/deliverables/v4";
import type { OwnerData } from "@/lib/model";
import { useDomains } from "@/lib/domains";
import { projectsIn } from "./corridor";
import { DeskFrame } from "./desk-frame";
import { Empty } from "./views";
import { useStepUp } from "./step-up";

/**
 * The client's book (v4 ADR-0053, ADR-0054): one document, read in chapters. v4 writes every sentence and decides which parts this
 * reader may see; the book only lays them out. The agency also sees a part not yet fit for the client, with the reason first, and
 * may propose keeping the brand for the client's next projects; the client's owner decides that here.
 */
type Chapter = "brand" | "kit" | "market" | "business";
const CHAPTERS: Record<Chapter, string> = { brand: "The brand", kit: "Selling it", market: "The market", business: "What it means for you" };

export type BookReader = "AGENCY" | "CLIENT_OWNER" | "CLIENT_MEMBER";

/** One book per project; a reader with several projects chooses which to open. */
export function ProjectBook({ projects, reader, initialProjectId }: { projects: readonly { id: string; name: string }[]; reader: BookReader; initialProjectId?: string | undefined }) {
  const [pid, setPid] = useState(projects.find((p) => p.id === initialProjectId)?.id ?? projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === pid) ?? projects[0];
  if (!project) return <Empty title="No project yet.">A project's book opens here once its brand or market work is done.</Empty>;
  return <>
    {projects.length > 1 && <select className="ws-select book-project" aria-label="Project" value={project.id} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
    <Book key={project.id} projectId={project.id} reader={reader} />
  </>;
}

/** The book on the agency's side: the Brand room's folio and the Market room's folders open the same book, for this room's projects. */
export function BookDesk({ data, dept }: { data: OwnerData; dept: string }) {
  const { list } = useDomains();
  const projects = projectsIn(data, dept, list);
  return (
    <DeskFrame kind="paper" eyebrow="THE CLIENT'S BOOK" title="The book" line="The brand, the words to sell it, the market and what it means for the business: one book per project, each chapter released to the client once it has passed its checks." tab="book" onTab={() => {}} tabs={[{ id: "book", label: "Book" }]}>
      <ProjectBook projects={projects} reader="AGENCY" />
    </DeskFrame>
  );
}

export function Book({ projectId, reader }: { projectId: string; reader: BookReader }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["book", projectId], queryFn: async () => { const r = await ds.deliverables.book(projectId); if (r.error) throw new Error(r.error.message); return r.data; } });
  const [chapter, setChapter] = useState<Chapter | null>(null);
  if (q.isLoading) return <p className="case-none">Opening the book…</p>;
  if (q.isError) return <p className="case-none">{(q.error as Error).message}</p>;
  const book: ClientBookView | null | undefined = q.data;
  if (!book) return <Empty title="No chapter of this book is ready yet.">Each chapter appears here once it has passed its checks.</Empty>;
  const chapters = (Object.keys(CHAPTERS) as Chapter[]).filter((c) => (c === "brand" || c === "kit" ? book.brand : book.market));
  const open = chapter && chapters.includes(chapter) ? chapter : chapters[0];
  return (
    <article className="book" aria-label="The book">
      {book.toCome.length > 0 && <ul className="book-to-come" aria-label="Still to come">{book.toCome.map((t) => <li key={t.part}>{t.why}</li>)}</ul>}
      {chapters.length > 0 && <nav className="book-chapters" role="tablist" aria-label="Chapters">
        {chapters.map((c, i) => <Button key={c} role="tab" variant="ghost" aria-selected={open === c} className={open === c ? "tab active" : "tab"} onClick={() => setChapter(c)}><span className="book-chapter-no">{String(i + 1).padStart(2, "0")}</span>{CHAPTERS[c]}</Button>)}
      </nav>}
      {open === "brand" && book.brand && <BrandChapter brand={book.brand} projectId={projectId} reader={reader} />}
      {open === "kit" && book.brand && <KitChapter brand={book.brand} />}
      {open === "market" && book.market && <MarketChapter report={book.market} />}
      {open === "business" && book.market && <BusinessChapter report={book.market} />}
    </article>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) =>
  <section className="book-section"><h3>{title}</h3>{children}</section>;
const Known = ({ status }: { status: keyof typeof STATUS_WORDS }) => <span className={`book-known known-${status.toLowerCase()}`}>{STATUS_WORDS[status]}</span>;
const Checks = ({ lines }: { lines: string[] }) => lines.length ? <footer className="book-checks"><b>How this was checked</b><ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul></footer> : null;
const written = (completedAt: string) => <p className="book-written">Written {fmtDate(completedAt)}</p>;

function BrandChapter({ brand, projectId, reader }: { brand: BrandBookView; projectId: string; reader: BookReader }) {
  return <div className="book-chapter">
    {written(brand.source.completedAt)}
    <header className="book-lead">
      <p className="book-statement">{brand.position.statement}</p>
      <p>{brand.position.difference}</p>
      <p className="book-proof"><b>Why it is true.</b> {brand.position.reasonToBelieve} <Known status={brand.position.status} /></p>
      {brand.position.signatureDevice && <p className="book-proof"><b>What people will recognise.</b> {brand.position.signatureDevice}</p>}
    </header>
    <Section title="Who it is for"><p>{brand.audienceStatement}</p></Section>
    {brand.promise && <Section title="The promise"><p className="book-quote">{brand.promise.statement}</p><p>{brand.promise.expectedOutcome}</p><small>{brand.promise.scope}</small></Section>}
    {brand.foundation && <Section title="What the business stands on">
      <dl className="book-pairs">{brand.foundation.statements.map((f) => <div key={f.kind}><dt>{FOUNDATION_WORDS[f.kind]}</dt><dd>{f.articulation}<small>From {f.source}</small></dd></div>)}</dl>
      {brand.foundation.values.length > 0 && <dl className="book-pairs">{brand.foundation.values.map((v) => <div key={v.value}><dt>{v.value}</dt><dd>{v.behavior}</dd></div>)}</dl>}
      {brand.foundation.notSourced.map((n) => <p key={n.kind} className="book-gap"><b>{FOUNDATION_WORDS[n.kind]}:</b> {n.reason}</p>)}
    </Section>}
    {brand.story && <Section title="The story">{STORY_PARTS.map((p) => <p key={p.key} className="book-story"><b>{p.title}.</b> {brand.story![p.key]}</p>)}</Section>}
    {brand.personality && <Section title="Personality">
      <dl className="book-pairs">{brand.personality.traits.map((t) => <div key={t.dimension}><dt>{t.position}<small>{t.dimension}</small></dt><dd>{t.behavior}</dd></div>)}</dl>
      {brand.personality.refuses.length > 0 && <p><b>It never sounds like:</b> {brand.personality.refuses.join(" · ")}</p>}
    </Section>}
    {brand.voice && <Section title={`The voice: ${brand.voice.name}`}>
      <p>{brand.voice.why}</p>
      <div className="book-words"><p><b>Words we use</b>{brand.voice.wordsWeUse.join(" · ")}</p><p><b>Words we avoid</b>{brand.voice.wordsWeAvoid.join(" · ")}</p></div>
      {brand.voice.sampleLines.map((l) => <p key={l.line} className="book-quote">{l.line}<small>{l.type}</small></p>)}
    </Section>}
    {brand.look && <Section title="The look">
      <p>{brand.look.personality}</p>
      <dl className="book-pairs"><div><dt>Type</dt><dd>{brand.look.typographyCharacter}</dd></div><div><dt>Colour</dt><dd>{brand.look.colorRole}</dd></div><div><dt>Shape</dt><dd>{brand.look.shapeLanguage}</dd></div></dl>
      <ul className="book-list">{brand.look.principles.map((p) => <li key={p}>{p}</li>)}</ul>
      {brand.look.distinctiveAssets.map((a) => <p key={a.asset}><b>{a.asset}</b> ({a.type}): {a.observableAs}</p>)}
      {brand.look.antiPatterns.length > 0 && <p><b>Never:</b> {brand.look.antiPatterns.join(" · ")}</p>}
    </Section>}
    {brand.alternatives.length > 0 && <Section title="The other positions considered">
      <ul className="book-list">{brand.alternatives.map((a) => <li key={a.id}>{a.statement}<small>{a.difference}</small></li>)}</ul>
    </Section>}
    {brand.stillToConfirm.length > 0 && <Section title="Still to confirm"><ul className="book-list">{brand.stillToConfirm.map((s) => <li key={s}>{s}</li>)}</ul></Section>}
    <Checks lines={brand.checks} />
    <KeepBrand projectId={projectId} reader={reader} />
  </div>;
}

function KitChapter({ brand }: { brand: BrandBookView }) {
  const kit = brand.kit;
  if (!kit) return <div className="book-chapter"><Empty title="The words to sell the business are still to be written.">Content writes them from the brand once it is chosen.</Empty></div>;
  return <div className="book-chapter">
    {written(kit.source.completedAt)}
    <header className="book-lead"><p className="book-statement">{kit.pitch.oneSentence}</p><p>{kit.pitch.threeSentences}</p></header>
    <Section title="Taglines">{kit.taglines.map((t) => <p key={t.line} className="book-quote">{t.line}<small>{t.rationale}</small></p>)}</Section>
    <Section title="About the business"><p>{kit.boilerplate.short}</p><p>{kit.boilerplate.long}</p></Section>
    <Section title="Headlines for advertising"><ul className="book-list">{kit.adHeadlines.map((h) => <li key={h.text}>{h.text}<small>{h.angle}</small></li>)}</ul></Section>
    <Section title="What to say, and to whom"><dl className="book-pairs">{kit.keyMessages.map((m) => <div key={m.audience}><dt>{m.audience}</dt><dd>{m.message}<small>Proof: {m.proof}</small></dd></div>)}</dl></Section>
    {kit.bios.length > 0 && <Section title="Profiles"><dl className="book-pairs">{kit.bios.map((b) => <div key={b.channel}><dt>{channelWords(b.channel)}</dt><dd>{b.text}</dd></div>)}</dl></Section>}
  </div>;
}

function Evidence({ report, ids }: { report: MarketReportView; ids: readonly string[] }) {
  const found = findingsFor(report, ids);
  if (!found.length) return null;
  return <details className="book-evidence"><summary>The evidence ({found.length})</summary>
    <ul>{found.map((f) => <li key={f.id}>{f.claim} <Known status={f.status} /><small>Confidence {f.confidence.level}: {f.confidence.basis} · as of {f.asOf}{f.sources[0] ? ` · ${f.sources.map((s) => s.locator).join("; ")}` : ""}</small></li>)}</ul>
  </details>;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function MarketChapter({ report }: { report: MarketReportView }) {
  return <div className="book-chapter">
    {report.banner && <p className="book-banner" role="note">{report.banner}</p>}
    {written(report.source.completedAt)}
    <header className="book-lead">
      <p className="book-statement">{report.question}</p>
      <p>It informs one decision for {lower(report.decision.decider)}: {lower(report.decision.decision)}.</p>
      <small>{report.field.name}, for {lower(report.field.audience)} · {[...report.scope.geography, report.scope.segment, report.scope.window].filter(Boolean).join(" · ")}</small>
    </header>
    {report.summaries.map((s) => <Section key={s.area} title={areaWords(s.area)}><p>{s.summary}</p><Evidence report={report} ids={s.findingIds} /></Section>)}
    {report.competitors.length > 0 && <Section title="Who else they could choose">
      <dl className="book-pairs">{report.competitors.map((c) => <div key={c.name}><dt>{c.name}</dt><dd>{COMPETITOR_WORDS[c.class]}</dd></div>)}</dl>
    </Section>}
    {report.contradictions.length > 0 && <Section title="Where sources disagree"><ul className="book-list">{report.contradictions.map((c) => <li key={c.note}>{c.note}</li>)}</ul></Section>}
    {report.gaps.length > 0 && <Section title="What we could not find">
      <ul className="book-list">{report.gaps.map((g) => <li key={g.section + g.missing}>{g.missing}: {g.reason}.<small>What would fill it: {g.wouldFill}. It could change: {g.couldChange}.</small></li>)}</ul>
    </Section>}
    <Checks lines={report.checks} />
  </div>;
}

function BusinessChapter({ report }: { report: MarketReportView }) {
  const reading = report.forYourBusiness;
  if (!reading) return <div className="book-chapter"><Empty title="What this means for the business is still to be written.">Business writes it from the research once the research is complete.</Empty></div>;
  return <div className="book-chapter">
    {written(reading.source.completedAt)}
    <header className="book-lead"><p className={reading.summary.length > 160 ? "book-statement long" : "book-statement"}>{reading.summary}</p></header>
    {(Object.keys(IMPLICATION_HEADINGS) as Array<keyof typeof IMPLICATION_HEADINGS>).map((kind) => {
      const these = reading.implications.filter((i) => i.kind === kind);
      return these.length ? <Section key={kind} title={IMPLICATION_HEADINGS[kind]}>
        {these.map((i) => <div key={i.statement} className="book-implication">
          <p>{i.statement} <Known status={i.status} /></p>
          <small>{lensWords(i.lens)} · What would change it: {i.wouldChangeIt}</small>
          <Evidence report={report} ids={i.findingIds} />
        </div>)}
      </Section> : null;
    })}
  </div>;
}

const KEPT_WORDS: Record<KeptBrand["status"], string> = {
  SUBMITTED: "Waiting for the client's owner to decide.", APPROVED: "Kept: it stands in for Brand on the next projects.", REJECTED: "The client's owner declined to keep it.",
  REVISION_REQUESTED: "The client's owner asked for changes.", SUPERSEDED: "A newer version was proposed.", WITHDRAWN: "Withdrawn: it no longer stands in.",
};

/** The agency proposes keeping the brand for the client's next projects; the client's owner decides (ADR-0026). */
function KeepBrand({ projectId, reader }: { projectId: string; reader: BookReader }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const { guard, panel } = useStepUp();
  const q = useQuery({ queryKey: ["kept-brand", projectId], queryFn: async () => { const r = await ds.deliverables.keptBrand(projectId); if (r.error) throw new Error(r.error.message); return r.data; } });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const kept = q.data ?? null;
  const done = (ok: string) => (r: { error: { message: string } | null }) => { setBusy(false); setMsg(r.error ? r.error.message : ok); void qc.invalidateQueries({ queryKey: ["kept-brand", projectId] }); };
  const keep = async () => { setBusy(true); setMsg(null); const r = await ds.deliverables.keepBrand(projectId); done("Sent to the client's owner to decide.")(r); };
  const decide = (approve: boolean) => { if (!kept) return; setBusy(true); setMsg(null); void guard(() => ds.deliverables.decideKeptBrand(kept.proposalId, approve), done(approve ? "Kept for your next projects." : "Declined.")); };
  if (reader === "CLIENT_MEMBER" && !kept) return null;
  return <aside className="book-keep" aria-label="Keep this brand">
    <h3><BookmarkCheck size={16} /> Keep this brand for future projects</h3>
    {kept ? <>
      <p>{kept.fitness}</p>
      <p className="book-keep-status" role="status">{KEPT_WORDS[kept.status]}{kept.decidedAt ? ` (${fmtDate(kept.decidedAt)})` : ""}</p>
      {kept.status === "SUBMITTED" && reader === "CLIENT_OWNER" && <div className="book-keep-actions">
        <Button variant="outline" className="reject-btn" disabled={busy} onClick={() => decide(false)}>Decline</Button>
        <Button className="approve-btn" disabled={busy} onClick={() => decide(true)}>Keep it</Button>
      </div>}
    </> : <p>{reader === "AGENCY" ? "Your next project for this client can start from this brand instead of making it again. The client's owner decides." : "The agency has not proposed keeping this brand yet."}</p>}
    {reader === "AGENCY" && (!kept || !["SUBMITTED", "APPROVED"].includes(kept.status)) && <Button className="approve-btn" disabled={busy} onClick={keep}>Propose keeping it</Button>}
    {panel}
    {msg && <p className="mmsg" role="status">{msg}</p>}
  </aside>;
}
