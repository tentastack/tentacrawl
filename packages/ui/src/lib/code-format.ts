import type { RunEnv } from '@tentacrawl/core/schema';

const htmlVoidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function formatAttributes(element: Element): string {
  const attributes = Array.from(element.attributes).map((attribute) => `${attribute.name}="${attribute.value}"`);
  return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function serializeNode(node: Node, indentLevel: number): string[] {
  const indent = '  '.repeat(indentLevel);

  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent ?? '';
    const parentTag = node.parentElement?.tagName.toLowerCase();

    if (parentTag === 'script' || parentTag === 'style' || parentTag === 'pre') {
      return textContent
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0)
        .map((line) => `${indent}${line}`);
    }

    const collapsed = collapseWhitespace(textContent);
    return collapsed ? [`${indent}${collapsed}`] : [];
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    const comment = (node.textContent ?? '').trim();
    return comment ? [`${indent}<!-- ${comment} -->`] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const openingTag = `${indent}<${tagName}${formatAttributes(element)}>`;

  if (htmlVoidTags.has(tagName)) {
    return [openingTag];
  }

  const childNodes = Array.from(element.childNodes);
  const meaningfulChildren = childNodes.flatMap((child) => serializeNode(child, indentLevel + 1));

  if (meaningfulChildren.length === 0) {
    return [`${openingTag}</${tagName}>`];
  }

  if (
    childNodes.length === 1
    && childNodes[0]?.nodeType === Node.TEXT_NODE
    && meaningfulChildren.length === 1
    && meaningfulChildren[0].length <= 100
  ) {
    return [`${openingTag}${collapseWhitespace(childNodes[0].textContent ?? '')}</${tagName}>`];
  }

  return [openingTag, ...meaningfulChildren, `${indent}</${tagName}>`];
}

function fallbackPrettifyHtml(html: string): string {
  return html
    .trim()
    .replace(/>\s*</g, '>\n<');
}

export function prettifyHtml(html: string): string {
  const normalizedHtml = html.trim();
  if (normalizedHtml.length === 0 || !normalizedHtml.includes('<')) {
    return normalizedHtml;
  }

  if (typeof DOMParser === 'undefined' || typeof Node === 'undefined') {
    return fallbackPrettifyHtml(normalizedHtml);
  }

  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(normalizedHtml, 'text/html');
    const lines: string[] = [];
    const hasDocumentShell = /<\s*html[\s>]|<\s*!doctype/i.test(normalizedHtml);

    if (hasDocumentShell && document.doctype) {
      lines.push(`<!DOCTYPE ${document.doctype.name}>`);
    }

    const roots = hasDocumentShell
      ? [document.documentElement]
      : Array.from(document.body.childNodes);

    roots.forEach((root) => {
      lines.push(...serializeNode(root, 0));
    });

    const formatted = lines.join('\n').trim();
    return formatted.length > 0 ? formatted : fallbackPrettifyHtml(normalizedHtml);
  } catch {
    return fallbackPrettifyHtml(normalizedHtml);
  }
}

export function formatUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\) /g, ')\n')
    .replace(/; /g, ';\n  ')
    .replace(/ (AppleWebKit|KHTML|Chrome|Safari|Version|Firefox|Gecko|Edg|OPR|CriOS|FxiOS|Mobile|SamsungBrowser|Electron)\//g, '\n$1/');
}

export function formatRunEnvironment(env: RunEnv): string {
  return JSON.stringify(
    {
      ...env,
      userAgent: env.userAgent ? formatUserAgent(env.userAgent) : env.userAgent,
    },
    null,
    2,
  );
}