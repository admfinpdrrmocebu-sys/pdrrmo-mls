/**
 * PDRRMO - IDOCS - Official OTP Verification Email Template Generator
 * Designed for high deliverability, cross-client email compatibility (Gmail, Outlook, Apple Mail),
 * and security-focused emergency management visual design.
 */

export interface OtpEmailData {
  email: string;
  otpCode: string;
  recipientName?: string;
  expiresMinutes?: number;
  logoSrc?: string;
}

export function generateOtpEmailHtml(data: OtpEmailData): string {
  const {
    email,
    otpCode,
    recipientName = 'Officer',
    expiresMinutes = 10,
    logoSrc = 'cid:pdrrmo-logo',
  } = data;

  // Split OTP into formatted display (e.g., individual digit spans for crisp display)
  const digits = otpCode.split('');

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>PDRRMO - IDOCS - Password Reset Verification Code</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, li, blockquote {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .otp-digit {
        font-size: 32px !important;
        padding: 12px 14px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B;">
  <div style="background-color: #F8FAFC; padding: 40px 16px;">
    <!-- Main Center Wrapper -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          
          <!-- Container Card -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" class="email-container" style="max-width: 560px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
            
            <!-- Top Accent Bar -->
            <tr>
              <td height="6" style="background: linear-gradient(90deg, #004AC6 0%, #0284C7 100%); line-height: 6px; font-size: 6px;">&nbsp;</td>
            </tr>

            <!-- Header Section with Official Shield -->
            <tr>
              <td class="mobile-padding" style="padding: 32px 40px 24px 40px; text-align: center; border-bottom: 1px solid #F1F5F9;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <img src="${logoSrc}" alt="PDRRMO Official Seal" width="60" height="60" style="display: block; margin-bottom: 12px; object-contain: contain;">
                      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.3px;">
                        PDRRMO - IDOCS
                      </h1>
                      <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 600; color: #475569;">
                        Integrated Data &amp; Operations Control System
                      </p>
                      <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #004AC6; text-transform: uppercase; letter-spacing: 0.8px;">
                        Identity &amp; Access Recovery Portal
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td class="mobile-padding" style="padding: 32px 40px 24px 40px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  
                  <!-- Greeting & Context -->
                  <tr>
                    <td>
                      <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 22px; color: #334155;">
                        Hello <strong>${recipientName}</strong>,
                      </p>
                      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
                        We received a request to reset the password for your PDRRMO - IDOCS account associated with 
                        <strong style="color: #0F172A;">${email}</strong>. Use the 4-digit verification code below to confirm your identity and proceed with the password change.
                      </p>
                    </td>
                  </tr>

                  <!-- 4-Digit OTP Box -->
                  <tr>
                    <td align="center" style="padding: 10px 0 28px 0;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 2px dashed #004AC6; border-radius: 14px; padding: 18px 28px;">
                        <tr>
                          <td align="center">
                            <span style="display: block; font-size: 11px; font-weight: 700; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
                              Security Verification Code
                            </span>
                            <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 14px; color: #004AC6; padding-left: 14px; text-align: center;">
                              ${otpCode}
                            </div>
                            <span style="display: block; font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 8px;">
                              ⏱️ Valid for ${expiresMinutes} minutes
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Security Advisory Notice -->
                  <tr>
                    <td style="padding: 0 0 20px 0;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px 16px;">
                        <tr>
                          <td style="font-size: 13px; line-height: 19px; color: #92400E;">
                            <strong>Security Warning:</strong> Never share this code with anyone, including PDRRMO administrators or staff. If you did not request this password reset, please disregard this email or report it to your IT administrator immediately.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Summary Detail -->
                  <tr>
                    <td style="padding-top: 10px; border-top: 1px solid #F1F5F9;">
                      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748B;">
                        Request Timestamp: <strong>${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (PHT)</strong><br>
                        Authorized Recipient: <strong>${email}</strong>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- Footer Section -->
            <tr>
              <td class="mobile-padding" style="padding: 24px 40px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                  PDRRMO - IDOCS · Integrated Data &amp; Operations Control System
                </p>
                <p style="margin: 0; font-size: 11px; line-height: 16px; color: #94A3B8;">
                  Provincial Disaster Risk Reduction and Management Office — Automated operational alert. Inquiries regarding this verification should be directed to the PDRRMO Systems &amp; Communications Desk.
                </p>
              </td>
            </tr>

          </table>
          <!-- End Container Card -->

        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

export function generateOtpEmailText(data: OtpEmailData): string {
  const {
    email,
    otpCode,
    recipientName = 'Officer',
    expiresMinutes = 10,
  } = data;

  return `
PDRRMO - IDOCS (Integrated Data & Operations Control System)
PASSWORD RESET VERIFICATION CODE
==================================================

Hello ${recipientName},

We received a request to reset the password for your PDRRMO - IDOCS account associated with ${email}.

Your 4-Digit Verification Code is:
>>> ${otpCode} <<<

This code will expire in ${expiresMinutes} minutes.

SECURITY WARNING:
Never share this code with anyone. If you did not request this password reset, you may ignore this email.

--
PDRRMO - IDOCS · Integrated Data & Operations Control System
Provincial Disaster Risk Reduction and Management Office
Automated Identity & Security Notification
`.trim();
}
