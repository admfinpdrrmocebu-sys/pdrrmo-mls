/**
 * PDRRMO MLS - Official Invitation Email Template Generator
 * Designed for high-deliverability, cross-client responsiveness (Gmail, Outlook, Apple Mail),
 * and professional emergency management operations UI/UX.
 */

export interface InvitationEmailData {
  email: string;
  role: 'admin' | 'monitoring' | 'staff';
  positionTitle: string;
  shift?: string;
  inviteUrl: string;
  invitedBy?: string;
  expiresAt?: string;
  logoSrc?: string;
}

export function generateInvitationEmailHtml(data: InvitationEmailData): string {
  const {
    email,
    role,
    positionTitle,
    shift = 'Day Shift (Alpha)',
    inviteUrl,
    invitedBy = 'PDRRMO System Administrator',
    expiresAt = 'Valid until registered',
    logoSrc = 'cid:pdrrmo-logo',
  } = data;

  const roleLabel =
    role === 'admin' ? 'Administrator' : role === 'monitoring' ? 'Monitoring Officer' : 'Operational Staff';

  const roleColor =
    role === 'admin' ? '#004AC6' : role === 'monitoring' ? '#0284C7' : '#505F76';

  const roleBg =
    role === 'admin' ? '#EFF6FF' : role === 'monitoring' ? '#F0F9FF' : '#F1F5F9';

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>PDRRMO MLS - System Access Invitation</title>
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
    a {
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
      .mobile-btn {
        width: 100% !important;
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 30px 10px; background-color: #F1F5F9;">
  <center style="width: 100%; table-layout: fixed;">
    <!-- Top Preheader Text (Hidden in body, visible in inbox previews) -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
      You have been granted official access to the PDRRMO Monitoring & Logging System. Activate your operational terminal credentials.
    </div>

    <!-- Main Email Container -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;" class="email-container">
      
      <!-- Top Agency Header -->
      <tr>
        <td align="center" style="padding-bottom: 16px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #64748B; text-transform: uppercase;">
                  Provincial Disaster Risk Reduction and Management Office
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main White Card -->
      <tr>
        <td style="background-color: #FFFFFF; border-radius: 24px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 74, 198, 0.06);">
          
          <!-- Banner / Header Strip -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background: linear-gradient(135deg, #002D7A 0%, #004AC6 60%, #0284C7 100%); padding: 30px 36px;" class="mobile-padding">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <!-- Official Logo & System Title -->
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color: #FFFFFF; border: 1.5px solid rgba(255, 255, 255, 0.6); border-radius: 14px; width: 48px; height: 48px; text-align: center; vertical-align: middle; padding: 4px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);">
                            <img src="${logoSrc}" alt="PDRRMO Official Logo" width="40" height="40" style="display: block; width: 40px; height: 40px; object-fit: contain; margin: 0 auto; border: 0;" />
                          </td>
                          <td style="padding-left: 14px;">
                            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.3px; line-height: 24px;">
                              PDRRMO · MLS
                            </h1>
                            <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.9);">
                              Monitoring &amp; Logging System Operations
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Body Content Area -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 36px 36px 28px 36px;" class="mobile-padding">
                
                <!-- Welcome Title -->
                <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #1E293B; letter-spacing: -0.5px;">
                  Official System Access Invitation
                </h2>
                
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #505F76;">
                  You have been authorized by <strong style="color: #1E293B;">${invitedBy}</strong> to access the Provincial Disaster Risk Reduction and Management Office (PDRRMO) Monitoring &amp; Logging System.
                </p>

                <!-- Credentials / Assignment Bento Box -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; margin-bottom: 28px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        
                        <!-- Row 1: Email Address -->
                        <tr>
                          <td style="padding-bottom: 12px; width: 38%; font-size: 12px; font-weight: 700; color: #757680; text-transform: uppercase; letter-spacing: 0.5px;">
                            Authorized Email
                          </td>
                          <td style="padding-bottom: 12px; font-size: 13px; font-weight: 600; color: #1E293B; font-family: monospace;">
                            ${email}
                          </td>
                        </tr>

                        <!-- Row 2: Assigned Position / Role -->
                        <tr>
                          <td style="padding-bottom: 12px; font-size: 12px; font-weight: 700; color: #757680; text-transform: uppercase; letter-spacing: 0.5px;">
                            Assigned Role
                          </td>
                          <td style="padding-bottom: 12px;">
                            <span style="display: inline-block; padding: 3px 10px; background-color: ${roleBg}; border: 1px solid ${roleColor}33; border-radius: 20px; font-size: 12px; font-weight: 700; color: ${roleColor};">
                              ● ${roleLabel} (${positionTitle})
                            </span>
                          </td>
                        </tr>

                        <!-- Row 3: Shift Schedule -->
                        <tr>
                          <td style="padding-bottom: 12px; font-size: 12px; font-weight: 700; color: #757680; text-transform: uppercase; letter-spacing: 0.5px;">
                            Shift Schedule
                          </td>
                          <td style="padding-bottom: 12px; font-size: 13px; font-weight: 600; color: #1E293B;">
                            🕒 ${shift}
                          </td>
                        </tr>

                        <!-- Row 4: Validity -->
                        <tr>
                          <td style="font-size: 12px; font-weight: 700; color: #757680; text-transform: uppercase; letter-spacing: 0.5px;">
                            Link Status
                          </td>
                          <td style="font-size: 13px; font-weight: 600; color: #004AC6;">
                            ● Valid until registered
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Primary Call to Action Button -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="mobile-btn">
                        <tr>
                          <td align="center" style="background-color: #004AC6; border-radius: 9999px; box-shadow: 0 4px 14px rgba(0, 74, 198, 0.35);">
                            <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-size: 14px; font-weight: 800; color: #FFFFFF; text-decoration: none; letter-spacing: 0.2px;">
                              Activate Terminal Access &amp; Set Password &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- 3 Step Onboarding Guide -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #E2E8F0; padding-top: 24px; margin-bottom: 24px;">
                  <tr>
                    <td>
                      <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; color: #1E293B; text-transform: uppercase; letter-spacing: 0.6px;">
                        Quick Onboarding Instructions
                      </p>
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="padding-bottom: 8px; font-size: 13px; color: #505F76; line-height: 18px;">
                            <strong style="color: #004AC6;">1.</strong> Click the blue button above to open the secure registration portal.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 8px; font-size: 13px; color: #505F76; line-height: 18px;">
                            <strong style="color: #004AC6;">2.</strong> Set your terminal password (min. 6 characters) and draw your digital sign-off signature.
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 13px; color: #505F76; line-height: 18px;">
                            <strong style="color: #004AC6;">3.</strong> Sign in to monitor live weather telemetry, log operational events, and conduct radio net roll calls.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Fallback Raw Link Box -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F5F9; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                  <tr>
                    <td>
                      <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #64748B;">
                        Having trouble with the button? Copy and paste this URL into your browser:
                      </p>
                      <p style="margin: 0; font-size: 11px; font-family: monospace; color: #004AC6; word-break: break-all; line-height: 16px;">
                        <a href="${inviteUrl}" style="color: #004AC6; text-decoration: underline;">${inviteUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>

          <!-- Official Security Footer -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0;">
            <tr>
              <td style="padding: 24px 36px;" class="mobile-padding">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #757680; text-transform: uppercase; letter-spacing: 0.5px;">
                        Security &amp; Confidentiality Notice
                      </p>
                      <p style="margin: 0 0 12px 0; font-size: 11px; color: #94A3B8; line-height: 16px;">
                        This transmission contains sensitive emergency operations data intended exclusively for authorized PDRRMO personnel. If you received this message in error, please immediately notify <a href="mailto:admin@mls.pdrrmo.gov.ph" style="color: #004AC6; text-decoration: underline;">admin@mls.pdrrmo.gov.ph</a> and delete this email.
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 16px;">
                        &copy; ${new Date().getFullYear()} Provincial Disaster Risk Reduction and Management Office (PDRRMO). All Rights Reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Bottom Spacer -->
      <tr>
        <td style="padding-top: 20px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #94A3B8;">
            Automated Operational Dispatch · PDRRMO Monitoring Logging System
          </p>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>
  `.trim();
}

export function generateInvitationEmailText(data: InvitationEmailData): string {
  const {
    email,
    role,
    positionTitle,
    shift = 'Day Shift (Alpha)',
    inviteUrl,
    invitedBy = 'PDRRMO System Administrator',
    expiresAt = 'Valid until registered',
  } = data;

  const roleLabel =
    role === 'admin' ? 'Administrator' : role === 'monitoring' ? 'Monitoring Officer' : 'Operational Staff';

  return `
PDRRMO MONITORING & LOGGING SYSTEM (MLS)
OFFICIAL SYSTEM ACCESS INVITATION
=====================================================

Hello,

You have been granted official system access by ${invitedBy} to the Provincial Disaster Risk Reduction and Management Office (PDRRMO) Monitoring & Logging System.

ASSIGNMENT DETAILS:
- Authorized Email: ${email}
- Assigned Role: ${roleLabel} (${positionTitle})
- Shift Schedule: ${shift}
- Status: Valid until registered

ACTIVATE YOUR ACCOUNT:
Please open the following secure link in your web browser to set your password and complete onboarding:
${inviteUrl}

QUICK ONBOARDING STEPS:
1. Open the activation link above.
2. Set your secure password (minimum 6 characters) and draw your signature.
3. Sign in to access real-time weather telemetry, roll calls, and operational logs.

CONFIDENTIALITY NOTICE:
This transmission contains sensitive emergency management operations data intended exclusively for authorized PDRRMO personnel. If you received this email in error, please notify admin@mls.pdrrmo.gov.ph.

(c) ${new Date().getFullYear()} Provincial Disaster Risk Reduction and Management Office (PDRRMO).
`.trim();
}
