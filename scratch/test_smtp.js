const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  });
}

async function testSmtp() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || '').trim();
  const pass = rawPass.replace(/\s+/g, '');

  console.log('--- SMTP Configuration Check ---');
  console.log('Host:', host);
  console.log('Port:', port);
  console.log('Secure (SSL/TLS):', secure);
  console.log('User:', user ? user : '(NOT SET in .env.local)');
  console.log('Pass:', pass ? '****** (16 chars set)' : '(NOT SET in .env.local)');

  if (!user || !pass) {
    console.log('\n❌ Reason email is not received:');
    console.log('SMTP_USER and SMTP_PASS are missing in your .env.local file.');
    console.log('\nTo send real emails to inboxes, add the following to .env.local:');
    console.log('----------------------------------------------------');
    console.log('SMTP_HOST=smtp.gmail.com');
    console.log('SMTP_PORT=587');
    console.log('SMTP_SECURE=false');
    console.log('SMTP_USER=clarion.jemino.ivan@gmail.com');
    console.log('SMTP_PASS=your_16_digit_app_password');
    console.log('SMTP_FROM="Ivan Dale Clarion" <clarion.jemino.ivan@gmail.com>');
    console.log('----------------------------------------------------');
    return;
  }

  const transporter = host.includes('gmail.com')
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      })
    : nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });

  try {
    console.log('\nConnecting to SMTP server...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully! Ready to send emails.');
  } catch (err) {
    console.error('❌ SMTP Connection Error:', err.message);
  }
}

testSmtp();
