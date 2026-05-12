const TEMPLATE_RE = /\{\{(\s*[\w.]+\s*)\}\}/g;

export function renderTemplate(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(TEMPLATE_RE, (_match, key: string) => {
    const trimmed = key.trim();
    const value = params[trimmed];
    return value !== undefined && value !== null ? String(value) : `{{${trimmed}}}`;
  });
}
