import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./screens.css";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
