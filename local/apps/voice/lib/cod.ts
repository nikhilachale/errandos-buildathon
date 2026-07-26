import { createHash } from 'node:crypto';

export type CodCheckoutSnapshot = {
  addressLabel: string;
  fingerprint: string;
  itemCount?: number;
  itemNames: string[];
  paymentMode: 'cod';
  total: number;
};

export function isExplicitCodConfirmation(transcript: string): boolean {
  const normalized = transcript
    .toLocaleLowerCase('en-IN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const hasCod = /\bcod\b/.test(normalized) || /\bc o d\b/.test(normalized);
  return hasCod && /\bconfirm\b/.test(normalized) && /\border\b/.test(normalized);
}

export function hasCodEvidence(source: string): boolean {
  return /(?:cash(?:\s+on)?|pay\s+on)\s+delivery/i.test(source)
    && !isCodUnavailable(source);
}

export function isCodUnavailable(source: string): boolean {
  return /(?:cash(?:\s+on)?|pay\s+on)\s+delivery.{0,80}(?:not\s+available|unavailable|disabled)/i
    .test(source.replace(/\s+/g, ' '));
}

export function buildCodCheckoutSnapshot(source: string): CodCheckoutSnapshot | undefined {
  if (!hasCodEvidence(source)) return undefined;
  const nodes = parseElements(source);
  const labels = nodes.flatMap(({ text, description }) => [description, text])
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  const total = extractTotal(labels);
  const address = labels.find((label) => /^delivering to\s+.+/i.test(label));
  if (total === undefined || !address) return undefined;

  const addressLabel = address
    .replace(/^delivering to\s+/i, '')
    .split(',', 1)[0]!
    .trim()
    .slice(0, 48);
  if (!addressLabel) return undefined;

  const itemNames = [...new Set(nodes
    .filter(({ resourceId }) => /\/title$/.test(resourceId ?? ''))
    .map(({ description, text }) => (description || text || '').trim())
    .filter((label) =>
      label
      && !/^(bill|cart|checkout|delivery|payment|coupon|tip|handling|platform)/i.test(label),
    ))].slice(0, 8);
  const itemCountText = labels.find((label) => /shipment of \d+ items?/i.test(label));
  const itemCount = Number(/shipment of (\d+) items?/i.exec(itemCountText ?? '')?.[1]);
  const material = {
    addressLabel,
    itemCount: Number.isInteger(itemCount) && itemCount > 0 ? itemCount : undefined,
    itemNames,
    paymentMode: 'cod' as const,
    total,
  };

  return {
    ...material,
    fingerprint: createHash('sha256').update(JSON.stringify(material)).digest('hex'),
  };
}

function extractTotal(labels: string[]): number | undefined {
  for (const [index, label] of labels.entries()) {
    if (!/\b(?:bill|grand|order)\s+total\b/i.test(label)) continue;
    for (const candidate of [
      label,
      labels[index + 1],
      labels[index - 1],
      labels[index + 2],
      labels[index - 2],
    ]) {
      const amount = /₹\s*([\d,.]+)/.exec(candidate ?? '')?.[1];
      if (!amount) continue;
      const parsed = Number(amount.replace(/,/g, ''));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return undefined;
}

function parseElements(source: string): Array<{
  description?: string;
  resourceId?: string;
  text?: string;
}> {
  return [...source.matchAll(/<(?!\/|\?|!)[A-Za-z_][\w.:-]*\b([^>]*)\/?>/g)]
    .map((match) => {
      const attributes = parseAttributes(match[1] ?? '');
      return {
        description: attributes['content-desc'],
        resourceId: attributes['resource-id'],
        text: attributes.text,
      };
    });
}

function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attributes[match[1]!] = decodeXml(match[2]!);
  }
  return attributes;
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}
