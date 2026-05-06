import { NextRequest } from 'next/server';
import { getLeaderboard } from '@/lib/backend/service';
import { errorResponse, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const leaderboard = await getLeaderboard();
    return json({ leaderboard });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to load leaderboard', 500);
  }
}
