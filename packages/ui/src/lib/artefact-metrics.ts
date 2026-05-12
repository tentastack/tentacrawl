export interface ArtefactMetricItem {
  label: string;
  value: string;
}

const textEncoder = new TextEncoder();

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getByteSize(value: string): number {
  return textEncoder.encode(value).length;
}

export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function countLines(value: string): number {
  return value.length === 0 ? 0 : value.split(/\r?\n/).length;
}

export function countObjectLeaves(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countObjectLeaves(item), 0);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total, item) => total + countObjectLeaves(item), 0);
  }

  return 1;
}

export function getBase64ByteSize(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}