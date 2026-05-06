import { z } from 'zod';
import { normalizeTelegramUsername } from './utils';

export const analyzeChannelSchema = z.object({
  channel_url: z.string().min(1),
});

export const compareChannelsSchema = z.object({
  channels: z.array(z.string().min(1)).min(1).max(3),
});

export const singleChannelSchema = z.object({
  channel_id: z.string().min(1).optional(),
  channel_url: z.string().min(1).optional(),
}).refine((value) => Boolean(value.channel_id || value.channel_url), {
  message: 'Either channel_id or channel_url is required',
});

export const chatStrategySchema = z.object({
  channel_id: z.string().min(1).optional(),
  channel_url: z.string().min(1).optional(),
  user_question: z.string().trim().min(1, 'Question is required').max(500, 'Question is too long'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(500),
    }),
  ).max(5).optional(),
}).refine((value) => Boolean(value.channel_id || value.channel_url), {
  message: 'Either channel_id or channel_url is required',
});

export const normalizeChannelInput = (value: string): string => normalizeTelegramUsername(value) || value.trim();
