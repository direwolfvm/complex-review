import { NextResponse } from 'next/server';
import { requireSession, requireStepAccess, errorResponse, ApiError } from '@/lib/api/session';
import { submitProjectInformation } from '@/lib/workflow/steps';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;
    const processInstanceId = Number.parseInt(processId, 10);
    if (!Number.isFinite(processInstanceId)) {
      throw new ApiError(400, 'Invalid case id');
    }

    const body = await request.json().catch(() => ({}));
    const formData = body?.formData;
    if (!formData || typeof formData !== 'object') {
      throw new ApiError(400, 'formData is required');
    }

    const session = await requireSession();
    await requireStepAccess(session, 2, processInstanceId);

    const result = await submitProjectInformation(session.db, {
      tenantId: session.tenantId,
      userId: session.userId,
      processInstanceId,
      formData: formData as Record<string, unknown>,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && /required|Case not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
