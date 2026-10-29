import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@pdrrmo.gov.ph';

// Configure Web Push VAPID credentials
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn('Error setting VAPID details in webpush:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, id, createdBy } = body;

    if (!title) {
      return NextResponse.json({ error: 'Announcement title is required' }, { status: 400 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured in environment, skipping push dispatch.');
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch all active push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('user_push_subscriptions')
      .select('*');

    if (error) {
      console.warn('Could not query user_push_subscriptions:', error.message);
      return NextResponse.json({
        success: true,
        sentCount: 0,
        notice: 'Push subscriptions table not migrated yet',
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No registered push devices' });
    }

    // Clean description preview (strip markdown or limit words)
    const previewText = (description || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/[*_#`~]/g, '')
      .slice(0, 160);

    const payload = JSON.stringify({
      title: `PDRRMO: ${title}`,
      description: previewText || 'A new official operational announcement has been published.',
      id: id || '',
      url: '/announcements',
      timestamp: Date.now(),
    });

    let sentCount = 0;
    const deadEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        // Skip creator if user_id matches
        if (createdBy && sub.user_id && sub.user_id === createdBy) {
          return;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400, // 24 hours
            urgency: 'high',
          });
          sentCount++;
        } catch (pushErr: any) {
          // If subscription has expired or is unsubscribed (404/410), mark for deletion
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            deadEndpoints.push(sub.endpoint);
          } else {
            console.warn('Push delivery notice for endpoint:', pushErr.message);
          }
        }
      })
    );

    // Prune dead subscriptions asynchronously
    if (deadEndpoints.length > 0) {
      await supabase.from('user_push_subscriptions').delete().in('endpoint', deadEndpoints);
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalDevices: subscriptions.length,
      prunedCount: deadEndpoints.length,
    });
  } catch (err: any) {
    console.error('Error in /api/announcements/notify POST:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
