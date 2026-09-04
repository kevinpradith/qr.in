// Everything here runs on the module grid qrcode-generator hands back: a square
// of booleans. Drawing it is a nested loop, so PNG and SVG are two renderings of
// the same grid rather than two libraries.

const $ = (id) => document.getElementById(id)
const els = {
  text: $('text'), size: $('size'), sizeOut: $('sizeOut'), ecOut: $('ecOut'),
  fg: $('fg'), bg: $('bg'), quiet: $('quiet'),
  canvas: $('canvas'), meta: $('meta'), error: $('error'), len: $('len'),
  png: $('png'), svg: $('svg'), copy: $('copy'),
}

const radios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)]
const picked = (name, fallback) => (radios(name).find((i) => i.checked) || { value: fallback }).value

// --- preferences -----------------------------------------------------------
// Theme and language are the two things the page remembers. Both are already on
// the root element by the time this file runs, put there by the inline script in
// the head; what is left here is keeping the controls, the storage and the root
// element in step when one of them is changed.

const store = (key, value) => {
  try {
    localStorage.setItem(`qr.in:${key}`, value)
  } catch {
    // Private modes and file:// on some browsers refuse storage. The preference
    // still applies to this page, it just will not outlive it.
  }
}

const STRINGS = {
  en: {
    lede: 'A QR code from any text or link. Your browser draws it, and there is no server behind it.',
    appearance: 'Appearance',
    auto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    language: 'Language',
    textLabel: 'Text or link',
    ecLabel: 'Error correction',
    sizeLabel: 'Download size',
    colours: 'Colours',
    colourDark: 'Dark',
    colourLight: 'Light',
    quietLabel: 'Quiet zone',
    quietHint: 'Modules of margin. The spec asks for 4.',
    downloadPng: 'Download PNG',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Not supported',
    footer:
      'Nothing leaves this page: no upload, no request, no analytics. It works offline, and from a file:// path. QR encoding by',
    characters: (n) => `${n} character${n === 1 ? '' : 's'}`,
    recovers: (pct) => `recovers ${pct}`,
    meta: (n, px, level) => `${n}x${n} modules, ${px}px, level ${level}`,
    tooLong: 'Too much text for one QR code. Use a lower correction level.',
  },
  id: {
    lede: 'Kode QR dari teks atau tautan apa pun. Peramban Anda yang menggambarnya, dan tidak ada server di belakangnya.',
    appearance: 'Tampilan',
    auto: 'Otomatis',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    language: 'Bahasa',
    textLabel: 'Teks atau tautan',
    ecLabel: 'Koreksi kesalahan',
    sizeLabel: 'Ukuran unduhan',
    colours: 'Warna',
    colourDark: 'Gelap',
    colourLight: 'Terang',
    quietLabel: 'Zona sunyi',
    quietHint: 'Modul margin. Spesifikasinya meminta 4.',
    downloadPng: 'Unduh PNG',
    copy: 'Salin',
    copied: 'Tersalin',
    copyFailed: 'Tidak didukung',
    footer:
      'Tidak ada yang meninggalkan halaman ini: tanpa unggahan, tanpa permintaan, tanpa analitik. Berjalan luring, dan dari jalur file://. Pengodean QR oleh',
    characters: (n) => `${n} karakter`,
    recovers: (pct) => `memulihkan ${pct}`,
    meta: (n, px, level) => `${n}x${n} modul, ${px}px, tingkat ${level}`,
    tooLong: 'Teks terlalu panjang untuk satu kode QR. Turunkan tingkat koreksi.',
  },
}

const lang = () => (STRINGS[document.documentElement.lang] ? document.documentElement.lang : 'en')
const t = (key, ...args) => {
  const value = STRINGS[lang()][key]
  return typeof value === 'function' ? value(...args) : value
}

function applyLanguage() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  render()
}

// --- QR --------------------------------------------------------------------

const RECOVERY = { L: '7%', M: '15%', Q: '25%', H: '30%' }
const ecValue = () => picked('ec', 'M')
// Rounded, not just clamped: a fractional margin puts every module on a half
// pixel, and the scanner reads the blur rather than the grid.
const clampQuiet = () => Math.max(0, Math.min(16, Math.round(Number(els.quiet.value) || 0)))

// The library's default byte encoder is `charCodeAt(i) & 0xff`, which silently
// truncates every character above U+00FF: "\u65e5" encodes as one byte, 0xE5, and the
// code scans as garbage. Every scanner reads byte mode as UTF-8, so switch to
// the UTF-8 encoder the library already ships.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']

// Version 0 means "pick the smallest version the data fits in". Over-long text
// fits in none, and the library throws.
function encode() {
  const qr = qrcode(0, ecValue())
  qr.addData(els.text.value)
  qr.make()
  return qr
}

// A module has to land on a whole number of pixels or the scanner reads a blur,
// so the requested size is a ceiling that gets rounded down to a multiple of the
// grid, never below 1 pixel per module.
function scaleFor(modules) {
  return Math.max(1, Math.floor(Number(els.size.value) / modules))
}

function drawTo(canvas, qr) {
  const n = qr.getModuleCount()
  const quiet = clampQuiet()
  const total = n + quiet * 2
  const scale = scaleFor(total)
  const px = total * scale

  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = els.bg.value
  ctx.fillRect(0, 0, px, px)
  ctx.fillStyle = els.fg.value
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale)
      }
    }
  }
  return { n, px }
}

// createSvgTag() only ever paints black on transparent, and the colour pickers
// have to mean something in the vector file too, so the path is built here.
function toSvg(qr) {
  const n = qr.getModuleCount()
  const quiet = clampQuiet()
  const total = n + quiet * 2
  let path = ''
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`
    }
  }
  const px = total * scaleFor(total)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`,
    ` width="${px}" height="${px}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${els.bg.value}"/>`,
    `<path d="${path}" fill="${els.fg.value}"/>`,
    `</svg>`,
  ].join('')
}

let current = null

function render() {
  els.sizeOut.textContent = `${els.size.value} px`
  els.ecOut.textContent = t('recovers', RECOVERY[ecValue()])
  // The filled part of the slider track is drawn by CSS from this percentage.
  const { min, max, value } = els.size
  els.size.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`)
  els.len.textContent = t('characters', [...els.text.value].length)

  try {
    current = encode()
    const { n, px } = drawTo(els.canvas, current)
    els.meta.textContent = t('meta', n, px, ecValue())
    els.error.textContent = ''
  } catch {
    current = null
    els.error.textContent = t('tooLong')
    els.meta.textContent = ''
  }
  for (const b of [els.png, els.svg, els.copy]) b.disabled = !current
}

function save(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Revoking in the same tick cancels the download in Firefox and Safari; the
  // click only queues it.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

els.png.onclick = () => els.canvas.toBlob((blob) => save('qr.png', blob))
els.svg.onclick = () => save('qr.svg', new Blob([toSvg(current)], { type: 'image/svg+xml' }))
els.copy.onclick = async () => {
  try {
    const blob = await new Promise((res) => els.canvas.toBlob(res))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    els.copy.textContent = t('copied')
  } catch {
    // Firefox has no image clipboard write, and file:// has no clipboard at all.
    els.copy.textContent = t('copyFailed')
  }
  setTimeout(() => (els.copy.textContent = t('copy')), 1500)
}

for (const el of [els.text, els.size, els.fg, els.bg, els.quiet, ...radios('ec')]) {
  el.addEventListener('input', render)
}

for (const input of radios('theme')) {
  input.checked = input.value === (document.documentElement.dataset.theme || 'auto')
  input.addEventListener('input', () => {
    if (input.value === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = input.value
    store('theme', input.value)
  })
}

for (const input of radios('lang')) {
  input.checked = input.value === lang()
  input.addEventListener('input', () => {
    document.documentElement.lang = input.value
    store('lang', input.value)
    applyLanguage()
  })
}

applyLanguage()
