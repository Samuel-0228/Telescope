import { NextRequest } from 'next/server';
import { compareChannelsSchema, parseTimeRange } from '@/lib/backend/validation';
import { compareChannels } from '@/lib/backend/service';
import { errorResponse, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = compareChannelsSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid request body', 400);
  }

  const result = await compareChannels({
    channelReferences: parsed.data.channels,
    timeRange: parseTimeRange(parsed.data.time_range),
  });

  return json(result);
}
