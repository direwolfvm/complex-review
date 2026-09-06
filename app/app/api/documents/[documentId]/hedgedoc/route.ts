import { NextResponse } from 'next/server';
import { requireSession, requireStepAccess, errorResponse, ApiError } from '@/lib/api/session';
import { loadDocumentContext, ensureHedgeDocNote } from '@/lib/workflow/documents';

/** Return this document's HedgeDoc note, minting one on first use. Idempotent. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: raw } = await params;
    const documentId = Number.parseInt(raw, 10);
    if (!Number.isFinite(documentId)) {
      throw new ApiError(400, 'Invalid document id');
    }

    const session = await requireSession();
    const doc = await loadDocumentContext(session.db, session.tenantId, documentId);
    if (!doc) {
      throw new ApiError(404, 'Document not found');
    }

    await requireStepAccess(session, doc.step, doc.parentProcessId);

    const note = await ensureHedgeDocNote(session.db, session.tenantId, doc);
    if (!note) {
      throw new ApiError(400, 'HedgeDoc is not configured');
    }

    return NextResponse.json(note);
  } catch (err) {
    return errorResponse(err);
  }
}
