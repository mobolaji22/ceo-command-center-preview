import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionLinkCard } from "@/components/cc/action-link";

// The address carries a credential: never let it travel in a Referer header, and never let a search engine keep it.
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Suspense><ActionLinkCard token={token} /></Suspense>;
}
