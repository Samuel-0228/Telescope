import { z } from 'zod';
import type { TimeRange } from './types';
import { normalizeTelegramUsername } from './utils';

export const timeRangeSchema = z.union([z.literal('30'), z.literal('60'), z.literal('90'), z.literal('all')]);

export const analyzeChannelSchema = z.object({
  channel_url: z.string().min(1),
  time_range: timeRangeSchema.optional().default('30'),
});

export const compareChannelsSchema = z.object({
  channels: z.array(z.string().min(1)).min(1).max(3),
  time_range: timeRangeSchema.optional().default('30'),
});

export const singleChannelSchema = z.object({
  channel_id: z.string().min(1).optional(),
  channel_url: z.string().min(1).optional(),
}).refine((value) => Boolean(value.channel_id || value.channel_url), {
  message: 'Either channel_id or channel_url is required',
});

export const normalizeChannelInput = (value: string): string => normalizeTelegramUsername(value) || value.trim();

export const parseTimeRange = (value: unknown): TimeRange => {
  const result = timeRangeSchema.safeParse(value);
  return result.success ? result.data : '30';
};
