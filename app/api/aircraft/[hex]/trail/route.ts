import { NextResponse } from 'next/server';
import { getTrail } from '@/app/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ hex: string }> }
) {
  const { hex } = await context.params;
  
  if (!hex || typeof hex !== 'string') {
    return NextResponse.json({ points: [] });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const from = fromParam ? parseInt(fromParam, 10) : undefined;

  const points = await getTrail(hex, from);

  return NextResponse.json({ points });
}
