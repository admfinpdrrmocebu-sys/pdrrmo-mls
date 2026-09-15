import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function getSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRoleKey && supabaseUrl) {
    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return await createClient();
}

/**
 * PATCH /api/users
 * Updates a user profile (Full Name, Role, Position Title, Shift, is_active status).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, full_name, role, position_title, default_shift, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Normalize role enum to 'admin' | 'monitoring' | 'staff'
    let normalizedRole: 'admin' | 'monitoring' | 'staff' = 'monitoring';
    if (role) {
      const lower = role.toString().toLowerCase();
      if (lower.includes('admin')) normalizedRole = 'admin';
      else if (lower.includes('staff')) normalizedRole = 'staff';
      else normalizedRole = 'monitoring';
    }

    const finalPositionTitle =
      position_title ||
      (normalizedRole === 'admin'
        ? 'System Administrator'
        : normalizedRole === 'staff'
        ? 'Operational Staff'
        : 'Monitoring Officer');

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updatePayload.full_name = full_name.trim();
    if (role !== undefined) updatePayload.role = normalizedRole;
    if (position_title !== undefined) updatePayload.position_title = finalPositionTitle;
    if (default_shift !== undefined) updatePayload.default_shift = default_shift;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    const client = await getSupabaseClient();

    // 2. Try standard Supabase update
    const { data, error } = await client
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    // If update returned an error OR returned null (which means RLS silently filtered out all rows)
    if (error || !data) {
      console.warn('Direct profile update did not update row, trying RPC admin_update_user_profile:', error?.message);
      // Fallback to RPC if direct update hit RLS
      const { data: rpcData, error: rpcErr } = await client.rpc('admin_update_user_profile', {
        p_user_id: id,
        p_full_name: full_name?.trim() || null,
        p_role: normalizedRole,
        p_position_title: finalPositionTitle,
        p_default_shift: default_shift || null,
        p_is_active: is_active !== undefined ? Boolean(is_active) : null,
      });

      if (rpcErr || !rpcData || rpcData.length === 0) {
        const errorMsg =
          rpcErr?.message ||
          error?.message ||
          'Row Level Security (RLS) on public.profiles prevented updating this user. Please execute the policy update in Supabase SQL Editor.';
        console.error('All profile update methods failed:', errorMsg);
        return NextResponse.json({ error: errorMsg, rlsBlocked: true }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        user: rpcData?.[0],
      });
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update user profile.';
    console.error('API /api/users PATCH Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/users
 * Removes a user profile and safely handles all foreign key associations.
 */
export async function DELETE(request: NextRequest) {
  try {
    let id: string | null = null;

    // Check query params or json body
    const searchParams = request.nextUrl.searchParams;
    id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // Body was empty or non-JSON
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'User ID is required for deletion.' }, { status: 400 });
    }

    const supabase = await getSupabaseClient();

    // 1. Try RPC delete first (cleans foreign keys atomically)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_delete_user_profile', {
      p_user_id: id,
    });

    if (!rpcErr && rpcData?.success) {
      return NextResponse.json({
        success: true,
        message: 'User profile and associated records removed successfully.',
        id,
      });
    }

    // 2. Manual cascade cleanup if RPC is not installed
    console.warn('RPC delete not available, executing manual cascading cleanup...');

    // A. Clean up duty roster assignments
    await supabase.from('duty_roster_assignments').delete().eq('profile_id', id);

    // B. Clean up shift duty personnel
    await supabase.from('shift_duty_personnel').delete().eq('profile_id', id);

    // C. Reassign lead_officer in shifts to another admin/user if present
    const { data: otherAdmin } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (otherAdmin?.id) {
      await supabase
        .from('shifts')
        .update({ lead_officer_id: otherAdmin.id })
        .eq('lead_officer_id', id);

      await supabase
        .from('shift_logs')
        .update({ operator_id: otherAdmin.id })
        .eq('operator_id', id);

      await supabase
        .from('roll_call_sessions')
        .update({ conducted_by: otherAdmin.id })
        .eq('conducted_by', id);
    }

    // D. Nullify invited_by in invitations
    await supabase.from('invitations').update({ invited_by: null }).eq('invited_by', id);

    // E. Delete profile row
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id);

    if (deleteError) {
      console.error('Direct delete error:', deleteError.message);
      // Fallback: If foreign keys still restrict delete, soft-delete user (deactivate & clear roster)
      const { error: deactError } = await supabase
        .from('profiles')
        .update({
          is_active: false,
          position_title: 'Deactivated User',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (deactError) throw deleteError;

      return NextResponse.json({
        success: true,
        message: 'User has been deactivated and removed from active roster.',
        id,
        softDeleted: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User removed successfully.',
      id,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete user.';
    console.error('API /api/users DELETE Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
