import { z } from 'zod';

const fieldSchema = z.object({
  name: z.string().min(1),
  selector: z.string().optional(),
  attr: z.string().optional(),
  fallback: z.string().optional()
});

const extractSchema = z.object({
  selector: z.string().optional(),
  fields: z.array(fieldSchema).optional(),
  maxItems: z.number().int().positive().optional(),
  includeRawHtml: z.boolean().optional()
}).optional();

const sourceSchema = z.object({
  url: z.string().url({ message: 'source.url must be a valid URL' }),
  selector: z.string().optional(),
  extract: extractSchema,
  headers: z.record(z.string()).optional()
});

const aiSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().positive().optional()
}).optional();

const metadataSchema = z.object({
  template_id: z.string().optional(),
  source: sourceSchema.optional(),
  user_id: z.string().optional(),
  subscription_id: z.string().optional()
}).optional();

const analyzeRequestSchema = z.object({
  texts: z.array(z.string().min(1)).min(1),
  subscription_id: z.string().optional(),
  user_id: z.string().optional(),
  source: sourceSchema.optional(),
  metadata: metadataSchema,
  ai: aiSchema,
  limit: z.number().int().positive().max(50).optional()
});

export function validateAnalyzeRequest(payload) {
  const enriched = {
    ...payload,
    source: payload.source || payload.metadata?.source || null
  };

  const result = analyzeRequestSchema.safeParse(enriched);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data;
  if (!data.source) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['source', 'url'],
          message: 'source.url is required either at root level or inside metadata.source'
        }
      ])
    };
  }

  return { success: true, data };
}

export default analyzeRequestSchema;
