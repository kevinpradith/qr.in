# Security policy

## Scope

qr.in is a static page. It has no server, no build step, no network calls at
runtime and no analytics: the text you type is encoded by JavaScript in your own
tab and never leaves it. The only data kept is two preferences, the appearance
and the language, in `localStorage`.

That makes most of the usual web attack surface absent. What is left, and worth
reporting:

- Anything that makes the page issue a network request.
- Anything that injects into the generated SVG or the page itself.
- A QR code that encodes something other than the text that was typed.

## Reporting

Open a [private security advisory](https://github.com/kevinpradith/qr.in/security/advisories/new),
or email kevinpradithh@gmail.com. Please do not open a public issue for a
vulnerability. Expect an acknowledgement within a few days.

## Supported versions

The latest release is the only supported version.
