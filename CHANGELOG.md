# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-04

First public release.

### Added

- QR code generation from any text or link, entirely in the browser.
- Error correction L / M / Q / H, download size, quiet zone, and both colours.
- Download as PNG or SVG, and copy the image to the clipboard.
- Auto / Light / Dark appearance and English / Bahasa Indonesia, both remembered
  in `localStorage` and applied before the first paint.
- `node test.js`: a stub DOM that checks the module grid, the scaling, the SVG
  output, the encoding, the wording in both languages, and the palette contrast.

### Fixed

- Text outside ASCII was encoded as one truncated byte per character, so a code
  containing an accent, an emoji or any non-Latin script decoded to garbage.
  Byte mode is now UTF-8.
- A fractional quiet zone put every module on a half pixel, which a scanner
  reads as a blur. The value is rounded as well as clamped.
- The object URL for a download was revoked in the same tick as the click, which
  cancels the download in Firefox and Safari.
- The error message reserved one line and wraps to two below about 700px, so
  showing it pushed the preview down.

[1.0.0]: https://github.com/kevinpradith/qr.in/releases/tag/v1.0.0
