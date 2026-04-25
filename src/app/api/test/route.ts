// src/app/api/test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Test endpoint funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasApiKey: !!process.env.HUGGING_FACE_API_KEY,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    status: 'ok',
    message: 'POST funcionando',
    received: body,
    timestamp: new Date().toISOString(),
  });
}