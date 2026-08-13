import { redirect } from 'next/navigation';

export default async function LegacyStoryboardPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  redirect(`/creative/${variantId}`);
}
