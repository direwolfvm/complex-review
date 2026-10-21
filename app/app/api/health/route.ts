import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness check for the cloud.gov health check. It answers without touching Supabase,
 * so a database outage does not make the platform restart a healthy process.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
