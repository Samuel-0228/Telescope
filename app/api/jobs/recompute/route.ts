import { NextRequest } from 'next/server';
import { runMaintenanceJobs } from '@/lib/backend/service';
import { errorResponse, json } from '@/lib/backend/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');

  if (secret && provided !== secret) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const result = await runMaintenanceJobs();
    return json(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Maintenance job failed', 500);
  }
}
