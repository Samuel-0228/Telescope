import { NextRequest } from 'next/server';
import { chatStrategySchema, normalizeChannelInput } from '@/lib/backend/validation';
import { chatStrategy } from '@/lib/backend/service';
import { errorResponse, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = chatStrategySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid request body', 400);
  }

  try {
    const channelReference = normalizeChannelInput(parsed.data.channel_url || parsed.data.channel_id || '');
    const result = await chatStrategy({
      channelReference,
      userQuestion: parsed.data.user_question,
      history: parsed.data.history || [],
    });

    return json(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate strategy answer', 500);
  }
}
