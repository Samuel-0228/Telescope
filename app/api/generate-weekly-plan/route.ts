import { NextRequest } from 'next/server';
import { singleChannelSchema } from '@/lib/backend/validation';
import { generatePlan } from '@/lib/backend/service';
import { errorResponse, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = singleChannelSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid request body', 400);
  }

  const channelReference = parsed.data.channel_url || parsed.data.channel_id || '';
  const result = await generatePlan(channelReference);
  return json(result);
}
