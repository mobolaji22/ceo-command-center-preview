"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Asset, AssetKind } from "@/lib/model";
import { fmtDate, label, statusTone } from "@/lib/format";
import { Empty } from "./views";

const KINDS: AssetKind[] = ["DOCUMENT", "IMAGE", "LOGO", "BRAND_GUIDE", "COPY_DECK", "FONT", "DESIGN_FILE", "DATA_EXPORT", "VIDEO", "AUDIO", "SITE_SNAPSHOT", "OTHER"];
const RIGHTS = ["OWNED_BY_CLIENT", "LICENSED", "PUBLIC_DOMAIN", "GENERATED", "THIRD_PARTY_UNCLEARED"];

const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

type Props = {
  organizationId: string;
  /** Set inside a project: its own files plus the organization library it inherits. */
  projectId?: string | undefined;
  /** The Client Owner and the agency may add files; members only read. */
  canWrite: boolean;
  /** The Client Owner may copy a project file into the library. */
  canPromote?: boolean | undefined;
  uploadedBy: "CLIENT_PROVIDED" | "CEO_PROVIDED";
};

/**
 * The asset library: what we hold for a client. Used for an organization's library and, with `projectId`, for one project
 * (its own files plus the library it inherits). A file can be downloaded only once it has passed its safety scan.
 */
export function Library({ organizationId, projectId, canWrite, canPromote, uploadedBy }: Props) {
  const ds = useDataSource();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: "DOCUMENT" as AssetKind, rights: "OWNED_BY_CLIENT", scope: projectId ? "PROJECT" : "ORGANIZATION", file: null as File | null });

  const load = useCallback(async () => {
    const r = await ds.assets.list({ organizationId, projectId });
    if (r.error) { setMsg(r.error.message); return; }
    setAssets(r.data);
  }, [ds, organizationId, projectId]);
  useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file) return;
    setBusy(true); setMsg(null);
    const r = await ds.assets.upload({
      organizationId, scope: form.scope as "ORGANIZATION" | "PROJECT", projectId: form.scope === "PROJECT" ? projectId ?? null : null,
      kind: form.kind, name: form.file.name, rights: form.rights, provenance: uploadedBy, file: form.file,
    });
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setMsg("Added. It passed its safety scan."); setForm({ ...form, file: null });
    (e.target as HTMLFormElement).reset();
    void load();
  };

  const download = async (id: string) => {
    const r = await ds.assets.downloadLink(id);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Couldn't prepare the download."); return; }
    window.location.assign(r.data.url);
  };
  const act = async (fn: () => Promise<{ error: { message: string } | null }>, done: string) => {
    const r = await fn();
    setMsg(r.error ? r.error.message : done); void load();
  };

  return <div className="library">
    {canWrite && <form className="mform" onSubmit={add} aria-label="Add a file">
      <h4>{projectId ? "Add a file" : "Add to the library"}</h4>
      <input type="file" required onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
      <select aria-label="Kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select>
      {projectId && <select aria-label="Where" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="PROJECT">This project only</option><option value="ORGANIZATION">Organization library</option></select>}
      <select aria-label="Rights" value={form.rights} onChange={(e) => setForm({ ...form, rights: e.target.value })}>{RIGHTS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select>
      <Button className="approve-btn" type="submit" disabled={busy || !form.file}>{busy ? "Uploading and scanning…" : "Upload"}</Button>
    </form>}
    {msg && <p className="mmsg" role="status">{msg}</p>}
    <div className="mlist">
      {assets === null ? <Empty title="Loading…" /> : assets.length === 0 ? <Empty title="No files yet." /> : assets.map((a) => {
        const v = a.versions[0];
        const clean = v?.scan_status === "CLEAN";
        return <div key={a.id} className="resolved-row"><span>{a.name}<small>{label(a.kind)} · {a.scope === "ORGANIZATION" ? "Library" : "This project"} · {label(a.rights)} · {v ? size(v.size_bytes) : ""} · {fmtDate(a.created_at)}</small></span>
          <span>
            <span className={`pill ${statusTone(v?.scan_status ?? "")}`}>{label(v?.scan_status ?? "unknown").toUpperCase()}</span>{" "}
            <Button variant="outline" disabled={!clean} onClick={() => download(a.id)}>Download</Button>
            {canPromote && a.scope === "PROJECT" && clean && <> <Button variant="outline" onClick={() => act(() => ds.assets.promote(a.id), "Copied to the organization library.")}>Add to library</Button></>}
            {canWrite && projectId && a.scope === "ORGANIZATION" && <> <Button variant="ghost" onClick={() => act(() => ds.assets.exclude(projectId, a.id), "This project will no longer use that file.")}>Don&apos;t use here</Button></>}
          </span></div>;
      })}
    </div>
  </div>;
}
