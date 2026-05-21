// api/_email-template.ts
// =============================================================================
// Shared branded email template.
// =============================================================================
// The `_` prefix marks this as a NON-ROUTE helper module. Vercel treats files
// in api/ as serverless endpoints; the underscore signals "this is imported by
// other api/ functions, it is not itself an endpoint." Do not add a default
// export / handler here.
//
// Used by:
//   - api/send-magic-link.ts        (profile magic-link email)
//   - api/send-invitation-email.ts  (CRM invitation email)
//
// EMAIL HTML IS NOT WEB HTML — read before editing:
//   - Layout is TABLE-based, not flexbox/grid. Outlook renders with Word's
//     engine and ignores modern CSS. Tables are the only reliable layout.
//   - All styling is INLINE (style="..."). <style> blocks are stripped or
//     ignored by several major clients (notably Gmail in some contexts).
//   - Fonts are a SYSTEM stack. Web fonts do not load in most email clients.
//   - The logo is a hosted PNG referenced by absolute URL. It is WHITE, so it
//     only appears inside the maroon header band — never on white.
//   - The logo has an explicit width (160) and `height:auto` so it keeps its
//     true aspect ratio whatever the source dimensions are, and an `alt` so
//     the email still reads if a client blocks images by default.
//   - The CTA is a real <a> styled as a button. SendGrid click-tracking
//     rewrites the href, but the visible LABEL stays clean — which is the
//     point: the recipient never sees a scary tracking URL.
//   - The raw URL is also printed below the button as a fallback for the
//     rare client that won't render the styled link.
// =============================================================================

export const AMTA_MAROON = "#70172a";
export const AMTA_LOGO_URL =
  "https://collegemocktrial.org/wp-content/uploads/2025/11/cropped-Main-Logo-White.png";
export const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Minimal HTML-escape for interpolated text values.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface BrandedEmailOptions {
  // Used in the <title> tag. Not visible in the body; some clients show it
  // as the preview/tab text.
  title: string;
  // The greeting line, e.g. "Hi Jane,". Pass already-composed; it is escaped
  // here, so pass raw text (not pre-escaped).
  greeting: string;
  // One or more paragraphs of body copy shown above the button. Each entry
  // is one <p>. Raw text — escaped here. Keep copy plain (no HTML).
  bodyParagraphs: string[];
  // The call-to-action button.
  buttonLabel: string;
  buttonUrl: string;
  // Fine-print paragraph(s) shown below the button, smaller/grey. Raw text.
  finePrint: string[];
  // The footer "you're receiving this because…" line. Raw text.
  footerNote: string;
}

/**
 * Render the full branded HTML email.
 *
 * All text fields are HTML-escaped internally — pass raw strings. URLs
 * (buttonUrl) are NOT escaped: they are expected to be system-generated
 * (origin + token), not user input. Do not pass user-controlled URLs here.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const greeting = escapeHtml(opts.greeting);

  const bodyHtml = opts.bodyParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(p)}</p>`,
    )
    .join("\n              ");

  const finePrintHtml = opts.finePrint
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(p)}</p>`,
    )
    .join("\n              ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6;">
  <!-- Outer wrapper: light gray, full width -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#f3f4f6; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- Card: fixed max width, centered -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:600px; max-width:600px; background-color:#ffffff;
                      border-radius:8px; overflow:hidden;">

          <!-- Maroon header band with white logo -->
          <tr>
            <td align="center"
                style="background-color:${AMTA_MAROON}; padding:28px 24px;">
              <img src="${AMTA_LOGO_URL}"
                   alt="American Mock Trial Association"
                   width="160"
                   style="display:block; width:160px; max-width:160px;
                          height:auto; border:0;">
            </td>
          </tr>

          <!-- White interior -->
          <tr>
            <td style="padding:32px 32px 8px 32px; font-family:${EMAIL_FONT_STACK};
                       color:#27272a; font-size:16px; line-height:1.6;">
              <p style="margin:0 0 16px 0;">${greeting}</p>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td align="center" style="padding:8px 32px 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center"
                      style="background-color:${AMTA_MAROON}; border-radius:6px;">
                    <a href="${opts.buttonUrl}"
                       style="display:inline-block; padding:13px 28px;
                              font-family:${EMAIL_FONT_STACK}; font-size:16px;
                              font-weight:600; color:#ffffff;
                              text-decoration:none;">
                      ${escapeHtml(opts.buttonLabel)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fine print + raw-URL fallback -->
          <tr>
            <td style="padding:0 32px 28px 32px; font-family:${EMAIL_FONT_STACK};
                       color:#52525b; font-size:14px; line-height:1.6;">
              ${finePrintHtml}
              <p style="margin:0 0 4px 0; color:#71717a; font-size:13px;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="margin:0; font-size:13px; word-break:break-all;">
                <a href="${opts.buttonUrl}" style="color:${AMTA_MAROON};">${opts.buttonUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#fafafa;
                       border-top:1px solid #e4e4e7;
                       font-family:${EMAIL_FONT_STACK}; color:#a1a1aa;
                       font-size:12px; line-height:1.5;">
              <p style="margin:0;">${escapeHtml(opts.footerNote)}</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
