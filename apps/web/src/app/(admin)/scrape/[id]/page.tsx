import { ScrapeDetailPage } from '@tentacrawl/scraper/frontend';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScrapeDetailRoute({ params }: Props) {
  const { id } = await params;
  return <ScrapeDetailPage id={id} />;
}
