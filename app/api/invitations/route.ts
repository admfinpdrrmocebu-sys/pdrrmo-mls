import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendInvitationEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      emails,
      email,
      role = 'monitoring',
      positionTitle = 'Monitoring Officer',
      shift = 'Day Shift (Alpha)',
      invitedBy = 'PDRRMO System Administrator',
      inviteUrl,
      token,
    } = body;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin ||
      'http://localhost:3000';

    const normalizedRole = (['admin', 'monitoring', 'staff'].includes(role?.toLowerCase())
      ? role.toLowerCase()
      : 'monitoring') as 'admin' | 'monitoring' | 'staff';

    // If a single invite with pre-generated inviteUrl/token was sent
    if (email && typeof email === 'string') {
      const recipientEmail = email.trim().toLowerCase();
      const finalToken = token || crypto.randomBytes(32).toString('hex');
      const finalUrl =
        inviteUrl ||
        `${origin}/register?token=${finalToken}&email=${encodeURIComponent(recipientEmail)}`;

      const emailResult = await sendInvitationEmail({
        email: recipientEmail,
        role: normalizedRole,
        positionTitle: positionTitle || 'Monitoring Officer',
        shift,
        inviteUrl: finalUrl,
        invitedBy,
        expiresAt: 'Valid until registered',
      });

      return NextResponse.json({
        success: true,
        emailResult,
        inviteUrl: finalUrl,
      });
    }

    // If an array of emails was sent
    if (emails && Array.isArray(emails) && emails.length > 0) {
      const results = [];

      for (const rawEmail of emails) {
        const recipientEmail = rawEmail.trim().toLowerCase();
        if (!recipientEmail || !recipientEmail.includes('@')) continue;

        const generatedToken = crypto.randomBytes(32).toString('hex');
        const generatedUrl = `${origin}/register?token=${generatedToken}&email=${encodeURIComponent(recipientEmail)}`;

        const emailResult = await sendInvitationEmail({
          email: recipientEmail,
          role: normalizedRole,
          positionTitle: positionTitle || 'Monitoring Officer',
          shift,
          inviteUrl: generatedUrl,
          invitedBy,
          expiresAt: 'Valid until registered',
        });

        results.push({
          email: recipientEmail,
          token: generatedToken,
          inviteUrl: generatedUrl,
          emailResult,
        });
      }

      return NextResponse.json({
        success: true,
        message: `${results.length} invitation email(s) dispatched.`,
        dispatched: results,
      });
    }

    return NextResponse.json(
      { error: 'Email or emails array is required.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'Internal server error processing invitation email.';
    console.error('API /api/invitations POST Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
