import { BriefPage } from "@/components/cc/briefs";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BriefPage id={id} />;
}
