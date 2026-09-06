import { NextResponse } from 'next/server';
import { requireSession, errorResponse, ApiError } from '@/lib/api/session';

/**
 * Mark one of the caller's own notifications read.
 *
 * Scoped by assigned_entity as well as tenant, so a caller can only dismiss
 * notifications addressed to them.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId: raw } = await params;
    const notificationId = Number.parseInt(raw, 10);
    if (!Number.isFinite(notificationId)) {
      throw new ApiError(400, 'Invalid notification id');
    }

    const session = await requireSession();

    const { data: notification } = await session.db
      .from('case_event')
      .select('*')
      .eq('id', notificationId)
      .eq('tenant_id', session.tenantId)
      .eq('type', 'notification')
      .eq('assigned_entity', session.userId)
      .single();

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    await session.db
      .from('case_event')
      .update({
        status: 'completed',
        other: {
          ...((notification.other as Record<string, unknown>) || {}),
          read: true,
          read_at: new Date().toISOString(),
        },
      })
      .eq('id', notificationId)
      .eq('tenant_id', session.tenantId);

    return NextResponse.json({ read: true });
  } catch (err) {
    return errorResponse(err);
  }
}
