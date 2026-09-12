import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import {
  generateInvitationEmailHtml,
  generateInvitationEmailText,
  InvitationEmailData,
} from './invitation-email';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Creates a Nodemailer transport instance using environment SMTP credentials.
 */
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || '').trim();
  // Strip spaces if 16-char app password was pasted with spaces
  const pass = rawPass.replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }

  // Use Nodemailer's built-in Gmail service if host is gmail
  if (host.includes('gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Dispatches an official PDRRMO MLS invitation email via SMTP.
 * If SMTP credentials are not yet supplied, it simulates delivery for seamless testing.
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<SendEmailResult> {
  const from =
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER
      ? `"PDRRMO MLS Administration" <${process.env.SMTP_USER}>`
      : '"PDRRMO MLS Administration" <no-reply@mls.pdrrmo.gov.ph>');

  const html = generateInvitationEmailHtml(data);
  const text = generateInvitationEmailText(data);
  const subject = `[PDRRMO MLS] Official System Access Invitation - ${data.positionTitle}`;

  const transporter = getSmtpTransporter();

  if (!transporter) {
    console.info('================================================================');
    console.info('✉️ [SMTP SIMULATION] User Invitation Dispatched:');
    console.info(`   To: ${data.email}`);
    console.info(`   Role: ${data.role} (${data.positionTitle})`);
    console.info(`   Shift: ${data.shift || 'Day Shift (Alpha)'}`);
    console.info(`   Activation Link: ${data.inviteUrl}`);
    console.info('   Note: Set SMTP_USER and SMTP_PASS in .env.local for live delivery.');
    console.info('================================================================');

    return {
      success: true,
      simulated: true,
      messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  try {
    const logoPath = path.join(process.cwd(), 'app/assets/image/logo.png');
    const attachments = [];

    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: 'logo.png',
        path: logoPath,
        cid: 'pdrrmo-logo',
      });
    }

    const info = await transporter.sendMail({
      from,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });

    console.info(`✅ [SMTP DISPATCHED] Email delivered to ${data.email}. Message ID: ${info.messageId}`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown SMTP dispatch failure.';
    console.error(`❌ [SMTP ERROR] Failed to deliver invitation to ${data.email}:`, error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
