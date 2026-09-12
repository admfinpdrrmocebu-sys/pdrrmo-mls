import { NextRequest, NextResponse } from 'next/server';
import { generateInvitationEmailHtml } from '@/lib/email/invitation-email';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email') || 'officer.cebu@pdrrmo.gov.ph';
  const role = (searchParams.get('role') || 'monitoring') as 'admin' | 'monitoring' | 'staff';
  const positionTitle = searchParams.get('positionTitle') || (role === 'admin' ? 'Administrator' : role === 'monitoring' ? 'Monitoring Officer' : 'Operational Staff');
  const shift = searchParams.get('shift') || 'Day Shift (Alpha)';
  const invitedBy = searchParams.get('invitedBy') || 'PDRRMO Operations Administrator';
  const origin = request.nextUrl.origin || 'http://localhost:3000';
  const inviteUrl = `${origin}/register?token=sample-preview-token-xyz123&email=${encodeURIComponent(email)}`;

  const logoSrc = `${origin}/assets/logo.png`;

  const html = generateInvitationEmailHtml({
    email,
    role,
    positionTitle,
    shift,
    inviteUrl,
    invitedBy,
    expiresAt: 'Valid until registered',
    logoSrc,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
