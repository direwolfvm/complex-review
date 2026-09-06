import { NextResponse } from 'next/server';
import { requireSession, requireStepAccess, errorResponse, ApiError } from '@/lib/api/session';
import { submitProjectInformation, submitDocumentStep } from '@/lib/workflow/steps';

const SUBMITTABLE_STEPS = [2, 3, 4];

/**
 * Submit a workflow step.
 *
 * One route for every submittable step so membership and step access are checked in a
 * single place. Step 2 carries form data; steps 3 and 4 carry document content.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ processId: string; step: string }> }
) {
  try {
    const { processId, step: stepParam } = await params;
    const processInstanceId = Number.parseInt(processId, 10);
    const step = Number.parseInt(stepParam, 10);

    if (!Number.isFinite(processInstanceId)) {
      throw new ApiError(400, 'Invalid case id');
    }
    if (!SUBMITTABLE_STEPS.includes(step)) {
      throw new ApiError(404, 'No such submittable step');
    }

    const body = await request.json().catch(() => ({}));

    const session = await requireSession();
    await requireStepAccess(session, step, processInstanceId);

    if (step === 2) {
      const formData = body?.formData;
      if (!formData || typeof formData !== 'object') {
        throw new ApiError(400, 'formData is required');
      }

      const result = await submitProjectInformation(session.db, {
        tenantId: session.tenantId,
        userId: session.userId,
        processInstanceId,
        formData: formData as Record<string, unknown>,
      });
      return NextResponse.json(result);
    }

    const result = await submitDocumentStep(session.db, {
      tenantId: session.tenantId,
      userId: session.userId,
      processInstanceId,
      step,
      content: typeof body?.content === 'string' ? body.content : '',
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && /required|Case not found|not a document step/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
