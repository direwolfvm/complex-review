import { NextResponse } from 'next/server';
import { requireSession, requireStepAccess, errorResponse, ApiError } from '@/lib/api/session';
import { decideApproval, type ApprovalDecision } from '@/lib/workflow/approval';

const DECISIONS: ApprovalDecision[] = ['approved', 'changes_requested'];

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

    // Authenticate before validating the body, so an anonymous caller cannot probe
    // the input rules.
    const session = await requireSession();

    const body = await request.json().catch(() => ({}));
    const decision = body?.decision as ApprovalDecision;
    const comments = typeof body?.comments === 'string' ? body.comments : '';

    if (!DECISIONS.includes(decision)) {
      throw new ApiError(400, 'decision must be "approved" or "changes_requested"');
    }

    // Separation of duties is enforced here, on the write, rather than only when the
    // approval page rendered: the approver must hold the role and must not be the
    // applicant or the analyst who prepared the review.
    await requireStepAccess(session, 5, processInstanceId);

    const result = await decideApproval(session.db, {
      tenantId: session.tenantId,
      userId: session.userId,
      processInstanceId,
      decision,
      comments,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && /Feedback is required|Case not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
