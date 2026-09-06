import { NextResponse } from 'next/server';
import { requireSession, requireStepAccess, errorResponse, ApiError } from '@/lib/api/session';
import { loadDocumentContext, saveDocumentContent } from '@/lib/workflow/documents';

/** Save editor content. The caller must be allowed to act on the step that owns it. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: raw } = await params;
    const documentId = Number.parseInt(raw, 10);
    if (!Number.isFinite(documentId)) {
      throw new ApiError(400, 'Invalid document id');
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.content !== 'string') {
      throw new ApiError(400, 'content is required');
    }

    const session = await requireSession();
    const doc = await loadDocumentContext(session.db, session.tenantId, documentId);
    if (!doc) {
      throw new ApiError(404, 'Document not found');
    }

    await requireStepAccess(session, doc.step, doc.parentProcessId);
    await saveDocumentContent(session.db, session.tenantId, session.userId, doc, body.content);

    return NextResponse.json({ saved: true });
  } catch (err) {
    return errorResponse(err);
  }
}
