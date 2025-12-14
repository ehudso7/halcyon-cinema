/**
 * Email utility module for sending transactional emails.
 *
 * This module provides email sending functionality with support for multiple providers:
 * - **Resend** (recommended): Set `RESEND_API_KEY` environment variable
 * - **Console logging** (development): Default fallback when no provider is configured
 *
 * @module utils/email
 * @example
 * ```typescript
 * import { sendEmail, getPasswordResetEmailHtml } from '@/utils/email';
 *
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Hello</h1>',
 * });
 * ```
 */

/**
 * Options for sending an email.
 * @interface EmailOptions
 */
interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML content of the email */
  html: string;
  /** Optional plain text version (auto-generated from HTML if not provided) */
  text?: string;
}

/**
 * Result of an email send operation.
 * @interface EmailResult
 */
interface EmailResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Message ID from the email provider (if successful) */
  messageId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * Converts the following characters to their HTML entity equivalents:
 * - `&` → `&amp;`
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `"` → `&quot;`
 * - `'` → `&#x27;`
 *
 * @param text - The string to escape
 * @returns The escaped string safe for HTML insertion
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
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
 * Sends an email using the configured provider.
 *
 * The function checks for available email providers in the following order:
 * 1. Resend API (if `RESEND_API_KEY` is set)
 * 2. Console logging (in development mode)
 * 3. Returns error (in production without provider)
 *
 * @param options - Email options including recipient, subject, and content
 * @returns Promise resolving to the result of the send operation
 * @example
 * ```typescript
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   html: '<p>Welcome!</p>',
 * });
 *
 * if (result.success) {
 *   console.log('Email sent:', result.messageId);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
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
 * Sends an email using the Resend API.
 *
 * @param options - Email options including recipient, subject, and content
 * @returns Promise resolving to the result of the send operation
 * @see https://resend.com/docs/api-reference/emails/send-email
 * @internal
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
 * Generates HTML content for a password reset email.
 *
 * Creates a branded, responsive HTML email with:
 * - HALCYON-Cinema header with gold gradient branding
 * - Personalized greeting (if userName provided)
 * - Reset password button with the provided URL
 * - Fallback plain text link
 * - Footer with copyright
 *
 * All user-provided values are escaped to prevent XSS attacks.
 *
 * @param resetUrl - The password reset URL to include in the email
 * @param userName - Optional user's name for personalized greeting
 * @returns HTML string for the password reset email
 * @example
 * ```typescript
 * const html = getPasswordResetEmailHtml(
 *   'https://example.com/reset?token=abc123',
 *   'John Doe'
 * );
 * ```
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
