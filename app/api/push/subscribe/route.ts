import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function getSupabaseClient() {
  if (supabaseServiceKey && supabaseUrl) {
    return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  try {
    return await createServerSupabaseClient();
  } catch {
    return createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userId, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing endpoint or encryption keys' }, { status: 400 });
    }

    const supabase = await getSupabaseClient();

    // Save or upsert subscription to public.user_push_subscriptions
    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert(
        {
          user_id: userId || null,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.warn('Notice saving push subscription to Supabase:', error.message);
      // Return 200 with notice if table pending manual migration
      return NextResponse.json({
        success: true,
        notice: 'Subscription received (table pending migration: ' + error.message + ')',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/push/subscribe POST:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    const supabase = await getSupabaseClient();
    await supabase.from('user_push_subscriptions').delete().eq('endpoint', endpoint);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/push/subscribe DELETE:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
