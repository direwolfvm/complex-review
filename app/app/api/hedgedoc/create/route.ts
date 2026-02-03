import { NextResponse } from 'next/server';
import { createNote, isHedgeDocConfigured } from '@/lib/hedgedoc/client';

export async function POST(request: Request) {
  if (!isHedgeDocConfigured()) {
    return NextResponse.json({ error: 'HedgeDoc not configured' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title : 'Untitled';
    const initialContent = typeof body?.initialContent === 'string' ? body.initialContent : '';

    const result = await createNote(title, initialContent);
    if (!result) {
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
