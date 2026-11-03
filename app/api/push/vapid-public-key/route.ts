import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    'BIJ6Vz8cnZyFe76hVZqoHsGExgQIivB__UoW5eCjGgcWSbJzbJSDP6LIRloRYIlK--NIywmN_iVDR4VG8yqlbjc';

  const publicKey = rawKey.replace(/^["']|["']$/g, '').trim();

  return NextResponse.json({ publicKey });
}
