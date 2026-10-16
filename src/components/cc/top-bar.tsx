"use client";

import { LogOut, Settings2, Sun } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { setLighting, useLighting } from "@/lib/lighting";
import { LightingToggle } from "./lighting-toggle";

/**
 * The header the CEO and clients share. On a wide screen the lighting, Settings and Sign out icons sit in the bar. On a phone
 * (P6.21 P1) they would push the avatar off the screen, so they move into the account menu behind the avatar, which works at
 * every width. One header for both rooms, so they cannot drift apart.
 */
export function TopBar({ who, center, date, initials, onSettings, onSignOut }: {
  who: string; center: ReactNode; date?: string | undefined; initials: string; onSettings: () => void; onSignOut: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> {who}</span></div>
      <div className="topbar-center">{center}</div>
      <div className="topbar-right">
        {date && <span className="topbar-date">{date}</span>}
        <span className="topbar-icons">
          <LightingToggle />
          <Button variant="ghost" size="icon" className="icon-button" aria-label="Settings" title="Settings" onClick={onSettings}><Settings2 size={16} /></Button>
          <Button variant="ghost" size="icon" className="icon-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}><LogOut size={16} /></Button>
        </span>
        <AccountMenu initials={initials} onSettings={onSettings} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

function AccountMenu({ initials, onSettings, onSignOut }: { initials: string; onSettings: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const day = useLighting() === "day";
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!(e.target instanceof Node && ref.current?.contains(e.target))) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const choose = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar" aria-label="Your account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{initials}</button>
      {open && <div className="account-menu" role="menu" aria-label="Your account">
        <button type="button" role="menuitem" onClick={choose(onSettings)}><Settings2 size={16} /> Settings</button>
        <button type="button" role="menuitemcheckbox" aria-checked={day} onClick={() => setLighting(day ? "night" : "day")}><Sun size={16} /> Day lighting{day ? ": on" : ": off"}</button>
        <button type="button" role="menuitem" onClick={choose(onSignOut)}><LogOut size={16} /> Sign out</button>
      </div>}
    </div>
  );
}
