# sound-mural-web

Public site for **SoundMural — your music, painted across the room**.

Two static surfaces live in this one repo, both served from **Netlify** at
`soundmural.com`:

| Path | Purpose | Source |
| --- | --- | --- |
| `/` | Marketing homepage (one-pager) | `index.html`, `logo.png` |
| `/oauth/` | Spotify authorization-code hop back to the tvOS app | `oauth/index.html` |
| `/oauth/settings.html` | Decodes the app's debug-share QR payload | `oauth/settings.html` |

## Deploy (Netlify)

This is a plain static site — no build step. `netlify.toml` publishes the repo
root.

1. Create a Netlify site from this GitHub repo (or connect the repo on the
   dashboard after the fact).
2. Add the custom domain `soundmural.com` and point DNS at Netlify.
3. Push to `main`; Netlify rebuilds and publishes.

## The Spotify forwarder (`oauth/index.html`)

Spotify requires an **HTTPS** redirect URI (plain HTTP was removed 27 Nov 2025,
loopback excepted), but a tvOS app receives its callback on a custom scheme.
This page is the HTTPS hop in between:

```
Spotify ──HTTPS──▶  /oauth/  ──custom scheme──▶  Apple TV app
```

The forward destination (`appletv-visualizer://spotify-callback`) is a
**hardcoded constant** — never derived from the query string — which keeps this
from being an open redirector for authorization codes. It writes every value
with `textContent`, percent-encodes each forwarded parameter, navigates with
`location.replace`, sends `referrer: no-referrer`, forwards Spotify's `?error=`,
and offers a manual "Continue on Apple TV" button for browsers that only honor
custom-scheme navigation from a real user gesture.

**Residual risk (accepted):** whoever hosts this page — and its access logs,
plus browser history — can see authorization codes in the query string. This is
acceptable **only** because PKCE means the `code_verifier` never leaves the
Apple TV, so a logged code cannot be redeemed. The verifier must never be
logged, transmitted, or embedded anywhere.

No secrets live here. There is no client secret; the client ID and redirect URI
are public by design.

### Registering the redirect URI

In the [Spotify dashboard](https://developer.spotify.com/dashboard), add
**`https://soundmural.com/oauth/`** as a Redirect URI. Spotify matches exactly —
a missing or extra trailing slash is rejected. Put the same value in
`SPOTIFY_REDIRECT_URI` in the app's `Spotify.local.xcconfig`.

## The debug-share QR page (`oauth/settings.html`)

The Apple TV app renders its live settings + perf stats into a QR code whose URL
points here with a `?d=<base64url>` payload; this page decodes it client-side
and renders it with copy buttons. One-way: device → QR → webpage, no write-back.
The app's pointing URL lives in `PlayerOverlayModel.swift` (`debugShareBaseURL`).
