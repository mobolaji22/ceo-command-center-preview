import type { Metadata } from "next";
import type { ReactNode } from "react";
// The two typefaces ship with the app (bundled, not fetched from a third party), so a page never waits on, or reports an error
// for, an outside font request. Cormorant Garamond for names and headings, DM Sans for working text.
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import "./screens.css";
import "./motion.css";
import "./desks.css";
import "./day.css";
import "./workshop.css";
import "./lobby.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CEO Command Center — DevPlaybook",
  description: "Executive intelligence and governance, in one private workspace.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "CEO Command Center — DevPlaybook",
    description: "Executive intelligence and governance, in one private workspace.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
