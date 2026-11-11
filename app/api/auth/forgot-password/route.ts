import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPasswordResetOtpEmail } from '@/lib/email/mailer';

interface InMemoryOtpRecord {
  otpCode: string;
  expiresAt: number;
  isVerified: boolean;
  resetToken?: string;
  resetTokenExpiresAt?: number;
  userId: string;
}

// Module-level in-memory cache to guarantee fast and resilient OTP verification
// even before database schema migrations are applied.
const inMemoryOtpStore = new Map<string, InMemoryOtpRecord>();

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    throw new Error('Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing.');
  }

  const key = serviceRoleKey || anonKey!;
  const hasServiceRole = Boolean(serviceRoleKey);

  const client = createSupabaseClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client, hasServiceRole };
}

/**
 * POST /api/auth/forgot-password
 * Handles custom 4-digit OTP dispatch via SMTP and password resets.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, otp, resetToken, newPassword } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required.' }, { status: 400 });
    }

    const { client: supabaseClient, hasServiceRole } = getSupabaseClient();

    // -------------------------------------------------------------------------
    // ACTION 1: SEND 4-DIGIT OTP VIA SMTP
    // -------------------------------------------------------------------------
    if (action === 'send_otp') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Look up user in profiles table
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id, full_name, email')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      let userId = profile?.id;
      let recipientName = profile?.full_name || 'Officer';

      // Fallback: lookup in auth.users directly if service role key is available
      if (!userId && hasServiceRole) {
        try {
          const { data: userData } = await supabaseClient.auth.admin.listUsers();
          const authUser = userData?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (authUser) {
            userId = authUser.id;
            recipientName = (authUser.user_metadata?.full_name as string) || 'Officer';
          }
        } catch {
          // Ignore
        }
      }

      if (!userId) {
        return NextResponse.json(
          { error: 'No registered user account found with that email address.' },
          { status: 404 }
        );
      }

      // Generate strictly 4-digit numeric OTP (1000 - 9999)
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresMinutes = 10;
      const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

      // Save to in-memory store
      inMemoryOtpStore.set(normalizedEmail, {
        otpCode,
        expiresAt: expiresAt.getTime(),
        isVerified: false,
        userId,
      });

      // Save to database table password_reset_otps (graceful fallback if table is not yet migrated)
      try {
        await supabaseClient
          .from('password_reset_otps')
          .delete()
          .eq('email', normalizedEmail);

        await supabaseClient.from('password_reset_otps').insert({
          email: normalizedEmail,
          otp_code: otpCode,
          is_verified: false,
          expires_at: expiresAt.toISOString(),
        });
      } catch (dbErr) {
        console.warn('[Forgot Password] Note: password_reset_otps DB write skipped (fallback to memory cache):', dbErr);
      }

      // Dispatch 4-digit code email via SMTP
      const emailResult = await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        otpCode,
        recipientName,
        expiresMinutes,
      });

      if (!emailResult.success) {
        return NextResponse.json(
          { error: emailResult.error || 'Failed to dispatch verification email via SMTP.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'A 4-digit verification code has been dispatched to your email.',
        simulated: emailResult.simulated,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: VERIFY 4-DIGIT OTP
    // -------------------------------------------------------------------------
    if (action === 'verify_otp') {
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
      }
      if (!otp || typeof otp !== 'string') {
        return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const sanitizedOtp = otp.trim();

      if (sanitizedOtp.length !== 4) {
        return NextResponse.json({ error: 'Verification code must be exactly 4 digits.' }, { status: 400 });
      }

      let isValid = false;
      let dbRecordId: string | null = null;
      let matchedUserId: string | null = null;

      // Check DB table first
      try {
        const { data: records } = await supabaseClient
          .from('password_reset_otps')
          .select('id, otp_code, expires_at, is_verified')
          .eq('email', normalizedEmail)
          .eq('otp_code', sanitizedOtp)
          .eq('is_verified', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (records && records.length > 0) {
          isValid = true;
          dbRecordId = records[0].id;
        }
      } catch {
        // Fall back to memory cache
      }

      // Check in-memory store
      const memRecord = inMemoryOtpStore.get(normalizedEmail);
      if (!isValid && memRecord) {
        if (
          memRecord.otpCode === sanitizedOtp &&
          !memRecord.isVerified &&
          Date.now() < memRecord.expiresAt
        ) {
          isValid = true;
          matchedUserId = memRecord.userId;
        }
      }

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired 4-digit verification code. Please check your email or request a new code.' },
          { status: 400 }
        );
      }

      // Generate single-use resetToken (UUID)
      const resetToken = crypto.randomUUID();
      const resetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      // Update DB record
      if (dbRecordId) {
        try {
          await supabaseClient
            .from('password_reset_otps')
            .update({
              is_verified: true,
              reset_token: resetToken,
            })
            .eq('id', dbRecordId);
        } catch (dbErr) {
          console.warn('[Forgot Password] Note: failed to update DB reset token:', dbErr);
        }
      }

      // Update in-memory record
      if (memRecord) {
        inMemoryOtpStore.set(normalizedEmail, {
          ...memRecord,
          isVerified: true,
          resetToken,
          resetTokenExpiresAt,
        });
      } else {
        inMemoryOtpStore.set(normalizedEmail, {
          otpCode: sanitizedOtp,
          expiresAt: resetTokenExpiresAt,
          isVerified: true,
          resetToken,
          resetTokenExpiresAt,
          userId: matchedUserId || '',
        });
      }

      return NextResponse.json({
        success: true,
        resetToken,
        message: '4-digit code verified successfully.',
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: RESET PASSWORD
    // -------------------------------------------------------------------------
    if (action === 'reset_password') {
      if (!email || !resetToken || !newPassword) {
        return NextResponse.json(
          { error: 'Email, reset token, and new password are required.' },
          { status: 400 }
        );
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters.' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      let tokenValid = false;
      let targetUserId: string | null = null;

      // Check DB table
      try {
        const { data: records } = await supabaseClient
          .from('password_reset_otps')
          .select('id, is_verified, reset_token, expires_at')
          .eq('email', normalizedEmail)
          .eq('reset_token', resetToken)
          .eq('is_verified', true)
          .limit(1);

        if (records && records.length > 0) {
          tokenValid = true;
        }
      } catch {
        // Fall back to memory store
      }

      // Check in-memory store
      const memRecord = inMemoryOtpStore.get(normalizedEmail);
      if (memRecord && memRecord.resetToken === resetToken && memRecord.isVerified) {
        if (memRecord.resetTokenExpiresAt && Date.now() < memRecord.resetTokenExpiresAt) {
          tokenValid = true;
          if (memRecord.userId) {
            targetUserId = memRecord.userId;
          }
        }
      }

      if (!tokenValid) {
        return NextResponse.json(
          { error: 'Security reset token has expired or is invalid. Please restart the password recovery process.' },
          { status: 400 }
        );
      }

      // Determine target user ID
      if (!targetUserId) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('id')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (profile?.id) {
          targetUserId = profile.id;
        } else if (hasServiceRole) {
          const { data: userData } = await supabaseClient.auth.admin.listUsers();
          const authUser = userData?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (authUser) {
            targetUserId = authUser.id;
          }
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { error: 'Failed to locate user account for password update.' },
          { status: 404 }
        );
      }

      // 1. Try auth.admin.updateUserById if service role key is present
      let updated = false;
      let updateErrorMsg = '';

      if (hasServiceRole) {
        const { error: adminErr } = await supabaseClient.auth.admin.updateUserById(
          targetUserId,
          { password: newPassword }
        );
        if (!adminErr) {
          updated = true;
        } else {
          updateErrorMsg = adminErr.message;
        }
      }

      // 2. Fallback to RPC function admin_reset_user_password if service role is absent or failed
      if (!updated) {
        const { error: rpcErr } = await supabaseClient.rpc('admin_reset_user_password', {
          p_user_id: targetUserId,
          p_new_password: newPassword,
        });

        if (!rpcErr) {
          updated = true;
        } else {
          console.warn('[Forgot Password] RPC admin_reset_user_password failed:', rpcErr);
          updateErrorMsg =
            rpcErr.message ||
            'Unable to update password: SUPABASE_SERVICE_ROLE_KEY is required in .env.local, or execute supabase/create_password_reset_rpc.sql in your Supabase SQL Editor.';
        }
      }

      if (!updated) {
        return NextResponse.json(
          { error: updateErrorMsg || 'Failed to update user password.' },
          { status: 500 }
        );
      }

      // Clean up used OTP and reset tokens
      try {
        await supabaseClient
          .from('password_reset_otps')
          .delete()
          .eq('email', normalizedEmail);
      } catch {
        // Ignore
      }
      inMemoryOtpStore.delete(normalizedEmail);

      return NextResponse.json({
        success: true,
        message: 'Your password has been successfully updated.',
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error processing password recovery.';
    console.error('[Forgot Password API Error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
