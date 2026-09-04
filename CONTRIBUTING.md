# Contributing

Issues and pull requests are welcome. The project is small on purpose, so most
of this is about keeping it that way.

## Before you start

Read the design notes in the [README](README.md). Spacing and type both come off
a single ratio, and every colour is a `light-dark()` pair checked against WCAG.
A one-off number is the thing this repository is trying not to accumulate, so a
change that introduces one needs a reason in the pull request.

## The constraints

These are the decisions the project is built on, not preferences:

- **No build step, no framework, no package manager.** The page is opened from
  disk. If a change needs compiling, it does not belong here.
- **No network at runtime.** No CDN, no font fetch, no analytics, no telemetry.
  The one dependency is vendored for exactly this reason.
- **`qrcode.js` is not edited.** It is a verbatim copy of the upstream build. To
  change its behaviour, change how `app.js` calls it.
- **Accessibility is not optional.** Contrast, focus, target size and the
  `radiogroup` semantics are load-bearing, and `test.js` checks the first of them.

## Checks

```sh
node test.js
```

It has to print `ok`. Non-trivial logic gets an assertion in the same file; there
is no framework to add one to, and there does not need to be. CI runs the same
command on every push and pull request.

If a change touches layout, re-measure rather than assume: the README explains
how the no-layout-shift claim is checked with a headless browser.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), in
English, in the imperative:

    feat: add a WiFi preset
    fix: round the quiet zone so modules land on whole pixels
    docs: explain why there are two blues

The subject line says what changed; the body says why, if why is not obvious.

## Adding a language

One block in `STRINGS` in `app.js`, one radio in the language segment in
`index.html`, and a check that the preference segments still hold their fixed
widths, or the header will move when the language changes.
