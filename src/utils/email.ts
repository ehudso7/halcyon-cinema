/**
 * Email utility for sending transactional emails.
 *
 * Supports the following providers:
 * - Resend (recommended): Set RESEND_API_KEY
 * - Console logging (development): Default when no provider configured
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Send an email using the configured provider.
 * Falls back to console logging in development if no provider is configured.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html } = options;

  // Try Resend first (modern email API)
  if (process.env.RESEND_API_KEY) {
    return sendWithResend(options);
  }

  // Fall back to console logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[email] Development mode - Email would be sent:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  HTML Preview: ${html.substring(0, 200)}...`);
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  // In production without a configured provider, log a warning
  console.warn('[email] No email provider configured. Set RESEND_API_KEY to enable email sending.');
  console.warn(`[email] Attempted to send email to ${to} with subject: ${subject}`);

  return {
    success: false,
    error: 'No email provider configured'
  };
}

/**
 * Send email using Resend API
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
async function sendWithResend(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, text } = options;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'HALCYON-Cinema <noreply@halcyon-cinema.com>',
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      }),
    });

    if (!response.ok) {
      let error: { message?: string } = { message: 'Failed to send email' };
      try {
        error = await response.json();
      } catch (parseError) {
        console.error('[email] Failed to parse error response:', parseError);
      }
      console.error('[email] Resend API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.id
    };
  } catch (error) {
    console.error('[email] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate password reset email HTML
 */
export function getPasswordResetEmailHtml(resetUrl: string, userName?: string): string {
  // Escape user-provided values to prevent XSS
  const safeUserName = userName ? escapeHtml(userName) : null;
  const safeResetUrl = escapeHtml(resetUrl);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #333;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #D4AF37; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                HALCYON-Cinema
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #ffffff;">
                Reset Your Password
              </h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #a0a0a0;">
                ${safeUserName ? `Hi ${safeUserName},` : 'Hi there,'}<br><br>
                We received a request to reset your password. Click the button below to create a new password. This link will expire in 1 hour.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${safeResetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #D4AF37 0%, #B8960C 100%); color: #0a0a0a; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: #666;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>

              <p style="margin: 0; font-size: 12px; color: #555; word-break: break-all;">
                Or copy this link: ${safeResetUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #111; border-top: 1px solid #333; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                © ${new Date().getFullYear()} HALCYON-Cinema. Pioneering the future of visual storytelling.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
