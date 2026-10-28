"use client";

import { useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { isFreeKey, isPaletteKey, keyLabel, setSingleKeys, useSingleKeys, useWindowKeys } from "@/lib/shortcuts";

/**
 * The fast lane through a room. The scene stays the front door; this is for someone who already knows where they are going:
 * ⌘K (Ctrl K) opens one list of everywhere they can go and everything they can do, and single letters jump straight to a desk.
 * Both are built by the page from what it already holds (its desks, its rooms, the projects and decisions on screen); nothing here
 * reads data or decides anything, it only calls the page's own ways of moving.
 */
export type PaletteCommand = {
  id: string;
  group: string;
  label: string;
  /** A second line: what it is, or where it lives. Also searched. */
  hint?: string | undefined;
  /** More words that should find it. */
  keywords?: string[];
  /** The single key that does the same, shown beside it. */
  shortcut?: string | undefined;
  icon?: LucideIcon | undefined;
  run: () => void;
};

export type KeyBinding = { key: string; label: string; run: () => void };
/** Keys handled somewhere else (a desk's own), listed on the sheet so they can be found. */
export type KeyNote = { keys: string[]; label: string };

export function RoomKeys({ commands, bindings, notes, palette, setPalette, sheet, setSheet }: {
  commands: PaletteCommand[];
  bindings: KeyBinding[];
  notes?: { title: string; keys: KeyNote[] }[];
  palette: boolean;
  setPalette: (open: boolean) => void;
  sheet: boolean;
  setSheet: (open: boolean) => void;
}) {
  const single = useSingleKeys();
  // A chosen command moves somewhere new, and the new desk takes focus; the palette must not hand focus back as it closes.
  const moved = useRef(false);

  useWindowKeys((e) => {
    if (isPaletteKey(e)) { e.preventDefault(); setSheet(false); setPalette(!palette); return; }
    if (!single || !isFreeKey(e)) return;
    if (e.key === "?") { e.preventDefault(); setSheet(true); return; }
    if (e.key === "/") {
      const field = document.querySelector<HTMLInputElement>('.desk-panel input[type="search"]');
      if (field) { e.preventDefault(); field.focus(); }
      return;
    }
    const b = bindings.find((x) => x.key === e.key.toLowerCase());
    if (b) { e.preventDefault(); b.run(); }
  });

  const groups = [...new Set(commands.map((c) => c.group))];
  const choose = (c: PaletteCommand) => { moved.current = true; setPalette(false); c.run(); };

  return <>
    <Dialog open={palette} onOpenChange={(o) => { if (o) moved.current = false; setPalette(o); }}>
      <DialogContent className="cc-palette" onCloseAutoFocus={(e) => { if (moved.current) e.preventDefault(); }}>
        <DialogTitle className="sr-only">Search and jump</DialogTitle>
        <DialogDescription className="sr-only">Type to find a desk, a room, a project or a decision, then press Enter.</DialogDescription>
        <Command loop className="cc-palette-command">
          <CommandInput placeholder="Jump to a desk, room, project or decision…" />
          <CommandList className="cc-palette-list">
            <CommandEmpty>Nothing matches. Try fewer words.</CommandEmpty>
            {groups.map((g) => <CommandGroup key={g} heading={g}>
              {commands.filter((c) => c.group === g).map((c) => <CommandItem key={c.id} value={c.id} keywords={[c.label, c.hint ?? "", ...(c.keywords ?? [])]} onSelect={() => choose(c)} className="cc-palette-item">
                {c.icon && <c.icon size={16} aria-hidden="true" />}
                <span className="cc-palette-text"><span>{c.label}</span>{c.hint && <small>{c.hint}</small>}</span>
                {c.shortcut && single && <CommandShortcut><kbd>{keyLabel(c.shortcut)}</kbd></CommandShortcut>}
              </CommandItem>)}
            </CommandGroup>)}
          </CommandList>
          <div className="cc-palette-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> go</span><span><kbd>Esc</kbd> close</span><span><kbd>?</kbd> all shortcuts</span></div>
        </Command>
      </DialogContent>
    </Dialog>

    <Dialog open={sheet} onOpenChange={setSheet}>
      <DialogContent className="cc-keys">
        <DialogTitle className="cc-keys-title">Keyboard shortcuts<span className="period">.</span></DialogTitle>
        <DialogDescription className="cc-keys-line">Letters work when you are not typing in a field. Press <kbd>Esc</kbd> to close this.</DialogDescription>
        <div className="cc-keys-grid">
          <KeySection title="Everywhere">
            <KeyRow keys={["⌘", "K"]} label="Search and jump (Ctrl K on Windows)" />
            <KeyRow keys={["?"]} label="This list" />
            <KeyRow keys={["/"]} label="Search inside the open desk" />
            <KeyRow keys={["Esc"]} label="Back, or close" />
          </KeySection>
          <KeySection title="Go to">
            {bindings.map((b) => <KeyRow key={b.key} keys={[keyLabel(b.key)]} label={b.label} />)}
          </KeySection>
          {notes?.map((n) => <KeySection key={n.title} title={n.title}>{n.keys.map((k) => <KeyRow key={k.label} keys={k.keys} label={k.label} />)}</KeySection>)}
        </div>
        <label className="cc-keys-switch">
          <Switch checked={single} onCheckedChange={setSingleKeys} />
          <span><b>Single-letter shortcuts</b><small>Turn off if they clash with your screen reader. ⌘K always works.</small></span>
        </label>
      </DialogContent>
    </Dialog>
  </>;
}

function KeySection({ title, children }: { title: string; children: ReactNode }) {
  return <section><div className="eyebrow gold">{title}</div><dl>{children}</dl></section>;
}

function KeyRow({ keys, label }: { keys: string[]; label: string }) {
  return <div className="cc-keys-row"><dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt><dd>{label}</dd></div>;
}
