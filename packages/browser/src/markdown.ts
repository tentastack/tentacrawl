import TurndownService from 'turndown';

let turndownInstance: TurndownService | undefined;

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      hr: '---',
    });

    turndownInstance.remove(['script', 'style', 'noscript', 'iframe'] as (keyof HTMLElementTagNameMap)[]);
    turndownInstance.addRule('removeSvg', {
      filter: (node) => node.nodeName.toLowerCase() === 'svg',
      replacement: () => '',
    });
  }
  return turndownInstance;
}

export function htmlToMarkdown(html: string): string {
  const td = getTurndown();

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const markdown = td.turndown(cleaned);

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}
