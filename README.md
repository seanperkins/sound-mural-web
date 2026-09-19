# sound-mural-web

Public site for **SoundMural — your music, painted across the room**.

Static pages live in this repo, served from **Netlify** at `soundmural.com`:

| Path | Purpose | Source |
| --- | --- | --- |
| `/` | Marketing homepage (one-pager) | `index.html`, `logo.png` |
| `/privacy/` | Privacy policy, including radio reporting consent and older beta behavior | `privacy/index.html`, `information.css` |
| `/support/` | Contact, provider setup, purchase restoration and troubleshooting | `support/index.html`, `information.css` |
| `/oauth/` | Legacy Spotify authorization-code forwarder; not a supported launch source | `oauth/index.html` |
| `/oauth/settings.html` | Decodes the app's debug-share QR payload | `oauth/settings.html` |

## Launch offer and supported sources

SoundMural is not yet on the App Store. Launch Collection purchasing is
implemented and locally verified in the app, but live product configuration and
sandbox/device acceptance remain pending. The website describes the approved
launch offer, not an available purchase:

- **Free:** Julia, Aurora, Starfield, Breaker and Plasma, unlimited listening,
  and every supported source.
- **Launch Collection:** US $9.99 once for the exact 26 launch visuals shown on
  the homepage, including the free five, and updates to those visuals.
  Future collections will be sold separately. No SoundMural subscription.
- **Sources:** Plex, Jellyfin, Navidrome, Apple Music and Internet Radio.
  Provider subscriptions and server access are separate; radio needs no
  SoundMural account or music subscription.
- **Visual response:** server music and radio provide PCM audio for on-device
  analysis. Apple Music visuals are track-informed, not waveform analysis;
  Apple Music does not expose PCM audio samples to the app.

The app will show Apple's localized purchase price and restore ownership through
StoreKit using the purchasing Apple Account. Do not imply a purchase unlocks
future collections, that every source supports offline downloads, or that
Spotify is available at launch. The legacy OAuth route below remains in place
for existing infrastructure; it is not a product availability promise.

## Deploy (Netlify)

This is a plain static site — no build step. `netlify.toml` publishes the repo
root.

1. Create a Netlify site from this GitHub repo (or connect the repo on the
   dashboard after the fact).
2. Add the custom domain `soundmural.com` and point DNS at Netlify.
3. Push to `main`; Netlify rebuilds and publishes.

## The legacy Spotify forwarder (`oauth/index.html`)

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
