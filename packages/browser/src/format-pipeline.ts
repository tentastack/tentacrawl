import type { Page } from 'playwright';
import type { ArtefactFormat, ArtefactResult } from '@tentacrawl/core';
import { htmlToMarkdown } from './markdown';
import { extractMetadata } from './metadata';
import { discoverLinks } from './link-discovery';

export async function collectArtefacts(
  page: Page,
  artefactFormats: ArtefactFormat[],
  baseUrl: string,
): Promise<ArtefactResult> {
  const artefacts: ArtefactResult = {};
  const requested = new Set(artefactFormats);

  const needsHtml = requested.has('html') || requested.has('markdown');
  let html: string | undefined;

  if (needsHtml) {
    html = await page.content();
    if (requested.has('html')) {
      artefacts.html = html;
    }
  }

  if (requested.has('markdown') && html) {
    artefacts.markdown = htmlToMarkdown(html);
  }

  const parallel: Promise<void>[] = [];

  if (requested.has('metadata')) {
    parallel.push(
      extractMetadata(page).then((m) => {
        artefacts.metadata = m;
      }),
    );
  }

  if (requested.has('links')) {
    parallel.push(
      discoverLinks(page, baseUrl).then((l) => {
        artefacts.links = l;
      }),
    );
  }

  if (parallel.length > 0) {
    await Promise.all(parallel);
  }

  if (requested.has('screenshot')) {
    const buffer = await page.screenshot({ fullPage: true });
    artefacts.screenshot = buffer.toString('base64');
  }

  return artefacts;
}
