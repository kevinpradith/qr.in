// node test.js
// A stub DOM just wide enough to load app.js, so the drawing, the wording and
// the two preferences get exercised without a browser.
const assert = require('node:assert')
const fs = require('node:fs')
const vm = require('node:vm')

const listeners = new Map()
const stub = (props) => {
  const el = {
    ...props,
    addEventListener(type, fn) {
      listeners.set(`${el.id || el.value}:${type}`, fn)
    },
  }
  return el
}
const fire = (el, type = 'input') => listeners.get(`${el.id || el.value}:${type}`)()

const rects = []
const ctx = { fillStyle: '', fillRect: (x, y, w, h) => rects.push([x, y, w, h]) }

const els = {
  text: stub({ id: 'text', value: 'https://example.com' }),
  size: stub({ id: 'size', value: '512', min: '128', max: '2048', style: { setProperty() {} } }),
  sizeOut: stub({}),
  ecOut: stub({}),
  len: stub({}),
  fg: stub({ id: 'fg', value: '#000000' }),
  bg: stub({ id: 'bg', value: '#ffffff' }),
  quiet: stub({ id: 'quiet', value: '4' }),
  canvas: stub({ getContext: () => ctx, toBlob() {} }),
  meta: stub({}),
  error: stub({}),
  png: stub({}),
  svg: stub({}),
  copy: stub({}),
}

const radio = (name, value, checked) => stub({ id: `${name}-${value}`, name, value, checked })
const groups = {
  ec: ['L', 'M', 'Q', 'H'].map((v) => radio('ec', v, v === 'M')),
  theme: ['auto', 'light', 'dark'].map((v) => radio('theme', v, v === 'auto')),
  lang: ['en', 'id'].map((v) => radio('lang', v, v === 'en')),
}
const translated = ['lede', 'appearance', 'auto', 'themeLight', 'themeDark', 'language', 'textLabel',
  'ecLabel', 'sizeLabel', 'colours', 'colourDark', 'colourLight', 'quietLabel', 'quietHint',
  'downloadPng', 'copy', 'footer'].map((key) => stub({ dataset: { i18n: key } }))

const storage = new Map()
const html = { lang: 'en', dataset: {} }

const sandbox = {
  document: {
    documentElement: html,
    getElementById: (id) => els[id],
    querySelectorAll: (sel) =>
      sel === '[data-i18n]' ? translated : groups[sel.replace(/input\[name="(\w+)"\]/, '$1')] || [],
    createElement: () => ({ click() {} }),
  },
  localStorage: { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) },
  navigator: {},
  URL: { createObjectURL: () => '', revokeObjectURL() {} },
  Blob: class {},
  setTimeout,
  console,
}
sandbox.window = sandbox
const context = vm.createContext(sandbox)
const read = (f) => fs.readFileSync(`${__dirname}/${f}`, 'utf8')
vm.runInContext(read('qrcode.js'), context)
vm.runInContext(read('app.js'), context)

// --- drawing ---------------------------------------------------------------

// 25 modules is version 2 at level M, which is what this URL needs.
assert.strictEqual(els.meta.textContent, '25x25 modules, 495px, level M')
assert.strictEqual(els.len.textContent, '19 characters')
assert.strictEqual(els.ecOut.textContent, 'recovers 15%')
assert.strictEqual(els.error.textContent, '')

// 25 + 8 quiet modules into 512px rounds to 15px each, never a fraction.
const total = 25 + 8
const scale = Math.floor(512 / total)
assert.strictEqual(els.canvas.width, total * scale)
const modules = rects.slice(1) // rects[0] is the background fill
assert.ok(modules.length > 100 && modules.every(([, , w, h]) => w === scale && h === scale))

// Every dark module reaches the SVG, and the viewBox is in module units.
const svg = context.toSvg(context.encode())
assert.match(svg, new RegExp(`viewBox="0 0 ${total} ${total}"`))
assert.strictEqual((svg.match(/M\d+ \d+h1v1h-1z/g) || []).length, modules.length)

// Non-ASCII goes out as UTF-8, not as the library's default low byte. "\u65e5" is
// three bytes; the default encoder made it one, and the code scanned as garbage.
// Spread it: an array built inside the vm context has a different Array
// prototype, and deepStrictEqual compares those too.
const bytes = [...context.qrcode.stringToBytes('\u65e5')]
assert.deepStrictEqual(bytes, [0xe6, 0x97, 0xa5], 'byte mode must be UTF-8')

// A fractional quiet zone would put every module on a half pixel.
els.quiet.value = '2.5'
context.render()
assert.ok(rects.slice(1).every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)),
  'a fractional quiet zone must not push modules onto half pixels')
els.quiet.value = '4'
context.render()

// --- preferences -----------------------------------------------------------

// Every string exists in both languages, or switching leaves a blank label.
// `const` at the top level of a script is not a property of the global object,
// so the dictionary is read back by evaluating its name in the same context.
const STRINGS = vm.runInContext('STRINGS', context)
const [en, id] = [STRINGS.en, STRINGS.id]
assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(id).sort())
assert.ok(translated.every((el) => en[el.dataset.i18n]), 'a data-i18n key has no string')
assert.ok(translated.every((el) => el.textContent === en[el.dataset.i18n]))

html.lang = 'id'
fire(groups.lang[1])
assert.strictEqual(storage.get('qr.in:lang'), 'id')
assert.strictEqual(els.meta.textContent, '25x25 modul, 495px, tingkat M')
assert.strictEqual(els.len.textContent, '19 karakter')
assert.ok(translated.every((el) => el.textContent === id[el.dataset.i18n]))

// Theme writes the root attribute and the store; auto removes the attribute
// again so the page goes back to following the system.
fire(groups.theme[2])
assert.strictEqual(html.dataset.theme, 'dark')
assert.strictEqual(storage.get('qr.in:theme'), 'dark')
fire(groups.theme[0])
assert.strictEqual(html.dataset.theme, undefined)
assert.strictEqual(storage.get('qr.in:theme'), 'auto')

// Too much data for any version at level H: reported in the current language,
// not thrown.
els.text.value = 'x'.repeat(5000)
groups.ec[1].checked = false
groups.ec[3].checked = true
context.render()
assert.strictEqual(els.error.textContent, id.tooLong)
assert.strictEqual(els.meta.textContent, '')

// --- palette ---------------------------------------------------------------
// The colours are only as good as their contrast, and a palette drifts the
// moment somebody nudges one token. The tokens are read back out of the
// stylesheet so this checks what the page actually ships.

const css = read('index.html')
const tokens = {}
for (const [, name, value] of css.matchAll(/--([\w-]+):\s*(light-dark\([^)]*\)|#[0-9a-f]{6})/gi)) {
  const pair = value.match(/light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/i)
  tokens[name] = pair ? { light: pair[1], dark: pair[2] } : { light: value, dark: value }
}

// The preference segments are given a fixed width so that switching language
// cannot move anything: the labels differ in length, the controls do not.
for (const id of ['themeSeg', 'langSeg']) {
  assert.match(css, new RegExp(`#${id} \\{ grid-auto-columns: var\\(--phi-\\d\\); \\}`),
    `#${id} needs a fixed grid-auto-columns, or the header moves between languages`)
}

// The message wraps to two lines below about 700px, and in Indonesian at around
// 900px, so two lines are reserved. One line let it push the preview down the
// moment the text stopped fitting.
assert.match(css, /#error \{ margin: 0; min-height: 3\.236em;/,
  '#error must reserve two lines, or showing it shifts the layout')

// The content security policy in vercel.json pins the two inline blocks by
// hash. A hash goes stale silently: edit the stylesheet, forget the header, and
// the deployed page loses every style while the copy on disk looks perfect. So
// the hashes are recomputed here from the file that is actually shipped.
const crypto = require('node:crypto')
const sha256 = (text) => `sha256-${crypto.createHash('sha256').update(text).digest('base64')}`
const inline = (tag) => read('index.html').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))[1]
const policy = JSON.parse(read('vercel.json')).headers[0].headers
  .find((h) => h.key === 'Content-Security-Policy').value

for (const [tag, directive] of [['script', 'script-src'], ['style', 'style-src']]) {
  const want = sha256(inline(tag))
  assert.ok(policy.includes(`'${want}'`),
    `${directive} in vercel.json does not match the inline <${tag}>; it should hold '${want}'`)
}

// The point of the policy is the directive that is not there.
assert.ok(!/connect-src/.test(policy), 'connect-src must stay absent, so no fetch is allowed at all')
assert.match(policy, /default-src 'none'/)

const channel = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// 4.5 for text (WCAG 1.4.3), 3 for the edge of a control and for the focus ring
// (1.4.11).
const pairs = [
  ['ink', 'surface', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'bg', 4.5],
  ['accent-text', 'bg', 4.5],
  ['danger', 'surface', 4.5],
  ['line-control', 'surface', 3],
  ['line-control', 'surface-sunken', 3],
  ['accent-text', 'surface', 3],
  ['accent-text', 'surface-sunken', 3],
]

for (const scheme of ['light', 'dark']) {
  for (const [fg, bg, need] of pairs) {
    const ratio = contrast(tokens[fg][scheme], tokens[bg][scheme])
    assert.ok(ratio >= need, `${scheme}: ${fg} on ${bg} is ${ratio.toFixed(2)}, needs ${need}`)
  }
  // White sits on the accent fill, the one pair not made of two tokens.
  const onAccent = contrast('#ffffff', tokens.accent[scheme])
  assert.ok(onAccent >= 4.5, `${scheme}: white on accent is ${onAccent.toFixed(2)}, needs 4.5`)
}

console.log('ok')
