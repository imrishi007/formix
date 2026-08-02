"""
backend/emailer.py
Tiny SMTP sender for transactional email — today just password-reset links.

Env config (all optional):
  SMTP_HOST     — if unset, the app runs in DEV MODE (see below)
  SMTP_PORT     — default 587
  SMTP_USER     — login username (optional)
  SMTP_PASSWORD — login password (optional)
  EMAIL_FROM    — From address; defaults to SMTP_USER

Dev mode: with no SMTP_HOST configured, send_reset_link() does NOT email
anything — it returns the reset link so the caller can surface it in the API
response. That makes the whole forgot/reset flow testable locally (and on a
Render deploy that hasn't added SMTP yet) with zero email infrastructure.
Production correctness is the caller's job: when SMTP is configured the link
is emailed and the function returns None.
"""

import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

log = logging.getLogger("formix.emailer")


def _smtp_config():
    """Return (host, port, user, password, from_addr) or None if no SMTP host set."""
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        return None
    user = os.environ.get("SMTP_USER", "").strip()
    return (
        host,
        int(os.environ.get("SMTP_PORT", "587")),
        user,
        os.environ.get("SMTP_PASSWORD", ""),
        os.environ.get("EMAIL_FROM", "").strip() or (user or "noreply@formix.app"),
    )


def send_reset_link(to_email: str, reset_link: str) -> str | None:
    """Email a password-reset link.

    Returns the link (dev mode, nothing sent) or None (a real email was sent).
    NEVER raises: an SMTP failure is logged and treated as a no-send so the
    caller's API response stays stable (and doesn't leak whether the account
    exists via a 500 vs 200).
    """
    cfg = _smtp_config()
    if cfg is None:
        return reset_link  # dev mode — caller surfaces the link in the response

    host, port, user, password, from_addr = cfg
    msg = EmailMessage()
    msg["Subject"] = "Reset your Formix password"
    msg["From"] = formataddr(("Formix", from_addr))
    msg["To"] = to_email

    # Plain-text fallback (clients without HTML, accessibility, copy/paste).
    msg.set_content(
        "Hi there,\n\n"
        "Someone asked to reset the password for your Formix account. If that "
        "was you, open the link below to choose a new password (it expires in "
        "1 hour):\n\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email — your "
        "password will stay the same."
    )

    # HTML version — a big reset button in the accent blue, with the raw link
    # shown underneath for email clients that strip buttons.
    msg.add_alternative(
        f"""\
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e5ea;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 12px 40px;">
            <span style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">Formix</span>
            <span style="font-size:13px;color:#8e8e93;margin-left:6px;">.forml</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px;">
            <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;">Reset your password</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
              Someone asked to reset the password for your Formix account. If that
              was you, choose a new one by clicking the button below.
            </p>
            <p style="margin:0 0 24px 0;">
              <a href="{reset_link}" style="display:inline-block;background:#3d5afe;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:999px;">Reset password</a>
            </p>
            <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#71717a;">
              This link expires in <b>1 hour</b>. If the button doesn't work, copy and
              paste this address into your browser:
            </p>
            <p style="margin:0;font-size:12px;word-break:break-all;color:#71717a;">{reset_link}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 32px 40px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#8e8e93;">
              If you didn't request this, you can safely ignore this email — your
              password will stay the same.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
        subtype="html",
    )

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            if user:
                server.login(user, password)
            server.send_message(msg)
    except Exception:  # noqa: BLE001
        # Bad credentials, refused connection, TLS trouble, rate limit — log
        # the full traceback so operators can see WHY a reset email didn't go
        # out (e.g. in the Render logs), but keep the API response stable.
        log.error("Failed to send reset email to %s: %s", to_email, reset_link, exc_info=True)
        return None
    return None
