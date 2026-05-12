import { CrawlDetailPage } from '@tentacrawl/crawler/frontend';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inspectPageId?: string }>;
}

export default async function CrawlDetailRoute({ params, searchParams }: Props) {
  const { id } = await params;
  const { inspectPageId } = await searchParams;
  return <CrawlDetailPage id={id} initialInspectPageId={inspectPageId} />;
}