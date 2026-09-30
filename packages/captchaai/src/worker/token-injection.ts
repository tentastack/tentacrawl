import type { Page } from 'playwright';
import type { DetectedChallengeKind } from './captcha-detector';

const RESPONSE_FIELDS: Record<DetectedChallengeKind, string> = {
  'recaptcha-v2': 'g-recaptcha-response',
  'recaptcha-v3': 'g-recaptcha-response',
  'recaptcha-enterprise': 'g-recaptcha-response',
  turnstile: 'cf-turnstile-response',
};

export function responseFieldName(kind: DetectedChallengeKind): string {
  return RESPONSE_FIELDS[kind];
}

// Writes the solved token into the widget's response field so a later `click`
// or `fill` step can submit the form. It never submits anything itself.
export async function injectCaptchaToken(
  page: Page,
  kind: DetectedChallengeKind,
  token: string,
): Promise<boolean> {
  return page.evaluate(
    ({ field, value }) => {
      const nodes = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        `textarea[name="${field}"], input[name="${field}"], #${field}`,
      );

      if (nodes.length === 0) {
        const created = document.createElement('textarea');
        created.name = field;
        created.id = field;
        created.style.display = 'none';
        created.value = value;
        (document.querySelector('form') ?? document.body).appendChild(created);
        return true;
      }

      for (const node of Array.from(nodes)) {
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    },
    { field: responseFieldName(kind), value: token },
  );
}
