import { z } from 'zod';

export const ARTEFACT_FORMATS = ['html', 'markdown', 'metadata', 'links', 'screenshot', 'extracted'] as const;
export const artefactFormatSchema = z.enum(ARTEFACT_FORMATS);
export type ArtefactFormat = z.infer<typeof artefactFormatSchema>;

export const DEFAULT_ARTEFACT_FORMATS: ArtefactFormat[] = ['html', 'markdown', 'metadata', 'links'];

export const pageMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  canonicalUrl: z.string().optional(),
  favicon: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  ogUrl: z.string().optional(),
  ogType: z.string().optional(),
  ogSiteName: z.string().optional(),
  twitterCard: z.string().optional(),
  twitterTitle: z.string().optional(),
  twitterDescription: z.string().optional(),
  twitterImage: z.string().optional(),
  robots: z.string().optional(),
  author: z.string().optional(),
  publishedTime: z.string().optional(),
  modifiedTime: z.string().optional(),
});
export type PageMetadata = z.infer<typeof pageMetadataSchema>;

export const pageLinkSchema = z.object({
  url: z.string(),
  text: z.string(),
  isInternal: z.boolean(),
});
export type PageLink = z.infer<typeof pageLinkSchema>;

export const artefactResultSchema = z.object({
  html: z.string().optional(),
  markdown: z.string().optional(),
  metadata: pageMetadataSchema.optional(),
  links: z.array(pageLinkSchema).optional(),
  screenshot: z.string().optional(),
  extracted: z.record(z.unknown()).optional(),
});
export type ArtefactResult = z.infer<typeof artefactResultSchema>;