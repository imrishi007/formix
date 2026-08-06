"""
backend/routers/oauth.py
"Continue with Google / GitHub" OAuth login for Formix.

Flow (all handled here in the backend — the frontend never sees the provider):

  1. GET /auth/oauth/{provider}
       Redirects the browser to Google/GitHub's consent screen.  authlib
       stashes a CSRF `state` in a session cookie (SessionMiddleware, wired in
       main.py) and verifies it when we come back — this is what stops login
       CSRF attacks.

  2. GET /auth/oauth/{provider}/callback
       Exchanges the authorization code for an access token, fetches the
       user's profile (email/name/avatar), finds-or-creates the matching
       Formix User, issues the SAME kind of JWT as email/password login, then
       redirects the browser to the frontend with the token:

           <FRONTEND_URL>/auth/oauth/callback?token=...

       The frontend's callback page stores the token, calls GET /auth/me for
       the user object, and logs them in.

Env config (set in Render / .env for local dev):
  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
  FRONTEND_URL — where to bounce back after auth (falls back to the first
                 ALLOWED_ORIGINS entry, then localhost:3000).
"""

import logging
import os
from urllib.parse import urlencode

import httpx
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import create_access_token, frontend_url
from ..database import get_db
from ..models import User

log = logging.getLogger("formix")

router = APIRouter(prefix="/auth/oauth", tags=["auth"])

# The only providers this router knows how to talk to.
PROVIDERS = ("google", "github")

# Provider endpoint constants — hardcoded instead of relying on OIDC discovery
# so configuration needs no extra network round-trips.
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URL     = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL     = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE      = "https://api.github.com"

# authlib refuses to run OAuth2 flows over plain http unless told otherwise.
# Production is always https (Render), so this only matters for local dev.
os.environ.setdefault("AUTHLIB_INSECURE_TRANSPORT", "1")


# ── OAuth client registry ────────────────────────────────────────────────────
# Built lazily on first use so the app boots even when no provider is
# configured — a provider whose credentials are missing simply 503s when
# someone clicks its button (with a hint), instead of crashing startup.

_oauth: OAuth | None = None


def _get_oauth() -> OAuth:
    global _oauth
    if _oauth is not None:
        return _oauth

    oauth = OAuth()
    for provider in PROVIDERS:
        client_id = os.environ.get(f"{provider.upper()}_CLIENT_ID")
        client_secret = os.environ.get(f"{provider.upper()}_CLIENT_SECRET")
        if not client_id or not client_secret:
            continue  # provider not configured — skip it silently
        if provider == "google":
            oauth.register(
                name="google",
                client_id=client_id,
                client_secret=client_secret,
                authorize_url=GOOGLE_AUTHORIZE_URL,
                access_token_url=GOOGLE_TOKEN_URL,
                # openid/email/profile: we need the stable `sub`, the verified
                # email, and the display name + picture from /userinfo.
                client_kwargs={"scope": "openid email profile"},
            )
        else:
            oauth.register(
                name="github",
                client_id=client_id,
                client_secret=client_secret,
                authorize_url=GITHUB_AUTHORIZE_URL,
                access_token_url=GITHUB_TOKEN_URL,
                # user:email — without a scope GitHub returns a null email; this
                # scope lets us pull the verified primary address via /user/emails.
                client_kwargs={"scope": "user:email"},
            )
    _oauth = oauth
    return oauth


def _configured_or_503(provider: str):
    """Return the provider's authlib client or raise a friendly 503."""
    client = _get_oauth().create_client(provider)
    if client is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"'{provider}' sign-in is not configured on the server. "
                f"Set {provider.upper()}_CLIENT_ID and {provider.upper()}_CLIENT_SECRET."
            ),
        )
    return client


# ── Provider profile fetchers ────────────────────────────────────────────────
# Each returns a normalized dict: {subject, email, name, avatar_url}.  `subject`
# is the provider's immutable user id — the thing we key our find-or-create on.

async def _fetch_google_profile(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "subject": str(data["sub"]),
        "email": (data.get("email") or "").strip().lower() or None,
        "name": data.get("name") or None,
        "avatar_url": data.get("picture") or None,
    }


async def _fetch_github_profile(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{GITHUB_API_BASE}/user", headers=headers)
        resp.raise_for_status()
        data = resp.json()

        # GitHub only returns a public email; if it's missing we must ask the
        # /user/emails endpoint for the verified primary address.
        email = (data.get("email") or "").strip().lower() or None
        if not email:
            emails_resp = await client.get(f"{GITHUB_API_BASE}/user/emails", headers=headers)
            emails_resp.raise_for_status()
            for entry in emails_resp.json():
                if entry.get("primary") and entry.get("verified"):
                    email = entry["email"].strip().lower()
                    break
            if not email:
                for entry in emails_resp.json():
                    if entry.get("verified"):
                        email = entry["email"].strip().lower()
                        break

    return {
        "subject": str(data["id"]),
        "email": email,
        "name": data.get("name") or data.get("login"),
        "avatar_url": data.get("avatar_url") or None,
    }


# ── Find-or-create ───────────────────────────────────────────────────────────

def _find_or_create_oauth_user(db: Session, provider: str, profile: dict) -> User:
    """Locate the Formix account for an OAuth identity, creating/linking one.

    Precedence:
      1. Existing user with the same (provider, subject)  -> log straight in.
      2. Existing user with the same email (a password account) -> link the
         OAuth identity onto it so both login methods find the same account.
      3. Otherwise -> create a fresh account (hashed_password stays NULL;
         email+password login already fails safely for such accounts).

    The (provider, subject) unique constraint makes step 1 idempotent — a
    user can never be duplicated by signing in twice.

    Email matching is CASE-INSENSITIVE on purpose. Providers return the
    canonical lowercase address (Google especially), but an author may have
    registered with any casing ("RishiPraval@Gmail.com"). The users.email
    column is unique, so a case-sensitive comparison would miss the existing
    account and the create below would violate the constraint — surfacing as
    the 500 "existing account" bug. `func.lower(User.email) == email.lower()`
    makes the link idempotent regardless of how the address was typed.
    """
    subject = profile["subject"]

    user = (
        db.query(User)
        .filter(User.oauth_provider == provider, User.oauth_subject == subject)
        .first()
    )
    if user is not None:
        # Every login refreshes the display avatar from the provider so the
        # profile picture stays the author's current Gmail/GitHub image.
        _sync_provider_avatar(db, user, profile)
        return user

    email = profile.get("email")
    if email:
        user = (
            db.query(User)
            .filter(func.lower(User.email) == email.lower())
            .first()
        )
        if user is not None:
            # Existing account (e.g. signed up by email). Link the OAuth
            # identity onto it unless it already belongs to a different
            # provider — in that edge case just log them in as this user.
            if user.oauth_provider is None:
                try:
                    user.oauth_provider = provider
                    user.oauth_subject = subject
                    db.commit()
                except IntegrityError:
                    # A concurrent sign-in won the race and linked this identity
                    # first. Roll back, then re-query by (provider, subject) to
                    # pick up whoever actually owns it.
                    db.rollback()
                    user = (
                        db.query(User)
                        .filter(User.oauth_provider == provider, User.oauth_subject == subject)
                        .first()
                    )
                    if user is None:
                        raise
                else:
                    db.refresh(user)
            _sync_provider_avatar(db, user, profile)
            return user

    # Brand-new account. If the provider withheld the email (GitHub without a
    # verified public address), fall back to a synthetic unique address so the
    # NOT NULL email column still gets a value. Store the address lowercased
    # for consistency with the case-insensitive lookups above.
    user = User(
        email=(email or f"{provider}+{subject}@oauth.local").lower(),
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),  # seed from provider; user can override
        hashed_password=None,
        oauth_provider=provider,
        oauth_subject=subject,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Same address already exists (belt-and-braces for a casing/race the
        # lookup above missed) — roll back and reuse that account instead.
        db.rollback()
        user = (
            db.query(User)
            .filter(func.lower(User.email) == email.lower())
            .first()
            if email
            else None
        )
        if user is None:
            raise
    db.refresh(user)
    return user


def _sync_provider_avatar(db: Session, user: User, profile: dict) -> None:
    """Refresh the author's avatar from the provider on every OAuth login.

    The user asked for the profile picture to track their Gmail image — this
    is where that happens for OAuth sign-ins (email+password logins have no
    provider picture to sync from). Only applied when the provider actually
    returned a URL, and never touches the name/password.
    """
    avatar = profile.get("avatar_url")
    if avatar and user.avatar_url != avatar:
        user.avatar_url = avatar
        db.commit()
        db.refresh(user)


def _oauth_callback_uri(request: Request, provider: str) -> str:
    """Absolute URL the provider must send the browser back to after consent.

    Preferred base is RENDER_EXTERNAL_URL (always https on Render) because
    behind Render's proxy the request scheme can arrive as plain `http`, and
    Google refuses to redirect to an `http://...onrender.com` URI. Falls back
    to deriving from the request (correct for localhost dev).
    """
    base = os.environ.get("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
    if base:
        return f"{base}/auth/oauth/{provider}/callback"
    return str(request.url_for("oauth_callback", provider=provider))


def _oauth_error_reason(exc: Exception, provider: str, redirect_uri: str) -> str:
    """Map a provider callback failure to a safe, actionable message.

    We do NOT echo the raw exception text to the browser: it is provider
    error payload, potentially verbose or (theoretically) injectable, and the
    user's own words are never as useful as a fixed hint. Instead we pattern-
    match on the well-known failure signatures — the things that actually go
    wrong when someone stands up OAuth — and return a canned string for each.
    The full exception still reaches the Render logs via the caller's log.

    Special care goes to `redirect_uri_mismatch`, the overwhelmingly common
    failure when credentials are refreshed (Google/GitHub reject the exchange
    unless the app's console lists the exact callback URL). Surfacing the URI
    the server used lets the author copy-paste it into the console and unblock
    themselves without a code deploy. Unknown failures fall back to naming the
    exception type so the cause is visible in the UI, not just the logs.
    """
    name = type(exc).__name__.lower()
    text = f"{exc}".lower()

    if isinstance(exc, HTTPException):
        # The 503 from _configured_or_503 ("'github' sign-in is not configured
        # on the server") must not masquerade as a generic failure — an
        # unconfigured provider is an env problem the author can fix directly.
        return (
            f"'{provider}' sign-in is not configured on the server. "
            f"Set {provider.upper()}_CLIENT_ID and {provider.upper()}_CLIENT_SECRET."
        )

    if name == "mismatchingstateerror" or "mismatch" in text and "state" in text:
        return "Your sign-in session expired. Please try again."
    if "access_denied" in text or name == "accessdeniederror":
        return "You cancelled the sign-in."
    if "redirect_uri" in text and ("mismatch" in text or "does not match" in text):
        return (
            f"Sign-in is misconfigured: '{provider}' rejected the callback URL. "
            f"Add exactly this value to the app's Authorized redirect URIs: {redirect_uri}"
        )
    if "invalid_client" in text or name == "invalidclienterror":
        return "Sign-in is misconfigured: the provider rejected the client credentials."
    if "invalid_grant" in text or name == "invalidgranterror":
        return "That sign-in attempt has expired. Please try again."
    if "server_error" in text:
        return "The sign-in provider is having a temporary problem. Please try again in a moment."
    # Unknown failure — surface the exception TYPE (safe, it is just a class
    # name) so the next attempt tells us what actually went wrong instead of a
    # black-box generic message. The full exception body stays in the logs.
    return f"Could not sign in ({type(exc).__name__}). Please try again."


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{provider}")
async def oauth_authorize(provider: str, request: Request):
    """Step 1: bounce the browser to the provider's consent screen."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown OAuth provider '{provider}'")
    client = _configured_or_503(provider)
    redirect_uri = _oauth_callback_uri(request, provider)
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/{provider}/callback", name="oauth_callback")
async def oauth_callback(provider: str, request: Request):
    """Step 2: exchange the code, find-or-create the user, hand out a JWT.

    The whole handler is wrapped in broad excepts on purpose. A callback must
    NEVER surface as a raw 500 — the author's browser just came back from
    Google's consent page and the only way out is through us. Any failure
    (token exchange, provider hiccup, DB, JWT) logs the full traceback to the
    Render logs and bounces back to the frontend with a readable message.

    Why `except Exception` instead of the previous narrower tuple: authlib
    raises its own exception family (OAuthError, MismatchingStateError,
    InvalidGrantError, MissingTokenError, ...) which are NOT subclasses of
    ValueError/KeyError/httpx.HTTPError. That original tuple let a failed
    code exchange — exactly the "Internal Server Error" seen in production —
    slip through to a raw 500. Catch everything, log everything, never 500.
    """
    redirect_uri = _oauth_callback_uri(request, provider)
    _redirect = lambda **params: RedirectResponse(
        f"{frontend_url()}/auth/oauth/callback?{urlencode(params)}"
    )

    # Stage 1: provider client + code exchange + profile fetch.
    try:
        client = _configured_or_503(provider)
        token = await client.authorize_access_token(request, redirect_uri=redirect_uri)
        if provider == "google":
            profile = await _fetch_google_profile(token["access_token"])
        else:
            profile = await _fetch_github_profile(token["access_token"])
    except Exception as exc:  # noqa: BLE001
        log.error(
            "OAuth %s exchange failed (redirect_uri=%s): %s",
            provider,
            redirect_uri,
            exc,
            exc_info=True,
        )
        return _redirect(error=_oauth_error_reason(exc, provider, redirect_uri))

    # Stage 2: find-or-create the account and mint the JWT.
    db = next(get_db())
    try:
        user = _find_or_create_oauth_user(db, provider, profile)
        jwt_token = create_access_token({"sub": user.id})
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        # Log the request context too (was the CSRF state present? did the
        # session cookie survive the provider round-trip?) so a prod-only
        # failure is diagnosable from the logs alone.
        log.error(
            "OAuth %s find-or-create/token failed (email=%s, state_present=%s, session_cookie_present=%s): %s",
            provider,
            profile.get("email"),
            bool(request.query_params.get("state")),
            bool(request.cookies.get("session")),
            exc,
            exc_info=True,
        )
        return _redirect(error="Could not finish sign-in. Please try again or sign in with your email.")
    finally:
        db.close()

    return _redirect(token=jwt_token)
