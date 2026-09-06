import { NextResponse } from 'next/server';
import { requireSession, errorResponse } from '@/lib/api/session';
import { initializeCase } from '@/lib/workflow/engine';

/**
 * Create a case: project, process instance, first task and the step 1 payload.
 *
 * The browser used to issue those four inserts itself. Doing it here means the tenant
 * comes from the caller's membership rather than from a slug the client resolved, and
 * the sequence either completes or fails as one request.
 */
export async function POST() {
  try {
    const session = await requireSession();

    const { processInstance } = await initializeCase(session.db, session.userId, session.tenantId);

    return NextResponse.json({ processInstanceId: processInstance.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
