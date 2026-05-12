import Link from 'next/link';
import { Button, Panel, PanelContent } from '@tentacrawl/ui';
import { ArrowLeft, Compass, Home } from 'lucide-react';

type NotFoundContentProps = {
  inDashboard?: boolean;
};

export function NotFoundContent({ inDashboard = false }: NotFoundContentProps) {
  const homeHref = inDashboard ? '/dashboard' : '/';

  return (
    <div className="min-h-[calc(100vh-var(--header-height,4rem))] bg-grid flex items-center justify-center px-6 py-10">
      <Panel className="w-full max-w-3xl bg-surface border border-ink shadow-brutal">
        <PanelContent className="p-8 md:p-10">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.16em] text-muted">
            <Compass className="size-4" />
            <span>Error 404</span>
          </div>

          <div className="mt-4 space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Page Not Found</h1>
            <p className="text-sm md:text-base text-muted max-w-xl font-medium">
              The page you are looking for does not exist or has been moved. Let&apos;s get you back to a valid route.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="brutal" size="lg">
              <Link href={homeHref}>
                <Home className="size-4" />
                Go to {inDashboard ? 'Dashboard' : 'Home'}
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link href="/scrape">
                <ArrowLeft className="size-4" />
                Open Scrape Jobs
              </Link>
            </Button>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
