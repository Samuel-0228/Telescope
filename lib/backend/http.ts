import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const json = <T>(payload: T, status = 200): NextResponse<T> => NextResponse.json(payload, { status });

export const getIpAddress = (request: NextRequest): string => {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
};

export const errorResponse = (message: string, status = 400): NextResponse<{ error: string }> => json({ error: message }, status);
