import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const DEFAULT_DIST_DIR = 'dist'
const PRESENTATION_EXTENSION = '.md'
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---/
const TITLE_PATTERN = /^title:\s*(.+)\s*$/m
const SITE_TITLE = 'Bangwu Talks'
const EMPTY_STATE = '<div class="empty-state">还没有可用的演示文稿。</div>'
const PAGE_STYLES = `
:root{--bg:#081120;--bg-soft:rgba(15,23,42,.72);--border:rgba(148,163,184,.18);--card:rgba(15,23,42,.78);--text:#e5eef9;--muted:#94a3b8;--accent:#fb7185;--shadow:0 24px 80px rgba(0,0,0,.28)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:"Avenir Next","PingFang SC","Microsoft YaHei",sans-serif;color:var(--text);background:radial-gradient(circle at top left,rgba(56,189,248,.16),transparent 30%),radial-gradient(circle at 85% 20%,rgba(251,113,133,.16),transparent 26%),linear-gradient(160deg,#081120 0%,#0f1f38 48%,#10284a 100%)}
main{width:min(1120px,calc(100vw - 32px));margin:0 auto;padding:48px 0 64px}.hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:24px;align-items:stretch;margin-bottom:28px}
.hero-copy,.hero-meta,.deck-card{border:1px solid var(--border);border-radius:28px;background:var(--bg-soft);backdrop-filter:blur(16px);box-shadow:var(--shadow)}
.hero-copy{padding:36px}.hero-meta{padding:28px;display:flex;flex-direction:column;justify-content:space-between}.eyebrow,.deck-name,.meta-label{margin:0;color:var(--muted);text-transform:uppercase}
.eyebrow{margin-bottom:16px;font-size:12px;letter-spacing:.18em}h1{margin:0;font-size:clamp(36px,5vw,64px);line-height:1;letter-spacing:-.05em}
.lead{margin:18px 0 0;max-width:44rem;color:rgba(229,238,249,.82);font-size:17px;line-height:1.85}.tags,.deck-links{display:flex;flex-wrap:wrap}
.tags{gap:10px;margin-top:22px}.tag{padding:8px 12px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.06);font-size:13px}
.meta-label,.deck-name{font-size:13px;letter-spacing:.1em}.meta-value{margin:10px 0 0;font-size:28px;line-height:1.2}.meta-note{margin:12px 0 0;color:rgba(229,238,249,.76);line-height:1.7}
.deck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.deck-card{padding:24px;background:var(--card)}.deck-name{margin-bottom:12px}.deck-title{margin:0;font-size:24px;line-height:1.25}
.deck-links{gap:12px;margin-top:20px}.deck-link{display:inline-flex;align-items:center;justify-content:center;min-width:108px;padding:11px 14px;border-radius:999px;color:#fff7ed;text-decoration:none;background:linear-gradient(135deg,var(--accent) 0%,#f97316 100%)}
.deck-link-secondary{color:var(--text);background:rgba(255,255,255,.06)}.empty-state{padding:32px;border:1px dashed var(--border);border-radius:24px;color:var(--muted);text-align:center;background:rgba(15,23,42,.48)}
@media (max-width:860px){main{width:min(1120px,calc(100vw - 24px));padding:24px 0 40px}.hero{grid-template-columns:1fr}.hero-copy,.hero-meta,.deck-card{border-radius:24px}.hero-copy,.hero-meta{padding:24px}}
`

await main()

async function main() {
  const distDir = path.resolve(process.argv[2] ?? DEFAULT_DIST_DIR)
  const presentations = await collectPresentations(distDir)
  const html = renderPage(presentations)
  await fs.writeFile(path.join(distDir, 'index.html'), html, 'utf8')
}

async function collectPresentations(distDir) {
  const entries = await fs.readdir(distDir, { withFileTypes: true })
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(directories.map((name) => buildPresentationCard(distDir, name)))
}

async function buildPresentationCard(distDir, name) {
  const markdownPath = path.join(ROOT_DIR, `${name}${PRESENTATION_EXTENSION}`)
  const title = await readTitle(markdownPath, name)
  const pdfPath = path.join(distDir, `${name}.pdf`)

  return {
    href: `./${name}/`,
    name,
    pdfHref: await exists(pdfPath) ? `./${name}.pdf` : null,
    title,
  }
}

async function readTitle(markdownPath, fallbackName) {
  if (!(await exists(markdownPath))) {
    return formatName(fallbackName)
  }

  const content = await fs.readFile(markdownPath, 'utf8')
  const frontmatter = content.match(FRONTMATTER_PATTERN)?.[1] ?? ''
  const title = frontmatter.match(TITLE_PATTERN)?.[1]?.trim()
  return title ? title.replace(/^['"]|['"]$/g, '') : formatName(fallbackName)
}

function renderPage(presentations) {
  const cards = presentations.length > 0
    ? presentations.map(renderCard).join('\n')
    : EMPTY_STATE

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    renderHead(),
    renderBody(cards, presentations.length, formatUpdatedAt()),
    '</html>',
  ].join('\n')
}

function renderHead() {
  return `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_TITLE}</title>
  <meta name="description" content="Bangwu 的 Slidev 演示文稿索引页">
  <style>${PAGE_STYLES}</style>
</head>`
}

function renderBody(cards, count, updatedAt) {
  return `<body>
  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Bangwu Talks</p>
        <h1>把分享做成一套能持续发布的演示站点</h1>
        <p class="lead">这里收集了通过 GitHub Actions 自动构建并发布的 Slidev 演示文稿。每次更新主分支后，站点入口和对应演示都会自动刷新。</p>
        <div class="tags"><span class="tag">Slidev</span><span class="tag">GitHub Actions</span><span class="tag">GitHub Pages</span></div>
      </div>
      <aside class="hero-meta">
        <div>
          <p class="meta-label">Presentations</p>
          <p class="meta-value">${count}</p>
          <p class="meta-note">入口页会根据当前发布目录自动生成，PDF 链接会在对应文件存在时自动显示。</p>
        </div>
        <div>
          <p class="meta-label">Updated</p>
          <p class="meta-note">${updatedAt}</p>
        </div>
      </aside>
    </section>
    <section class="deck-grid">${cards}</section>
  </main>
</body>`
}

function renderCard(presentation) {
  const pdfLink = presentation.pdfHref
    ? `<a class="deck-link deck-link-secondary" href="${presentation.pdfHref}">下载 PDF</a>`
    : ''

  return `<article class="deck-card">
  <p class="deck-name">${escapeHtml(presentation.name)}</p>
  <h2 class="deck-title">${escapeHtml(presentation.title)}</h2>
  <div class="deck-links">
    <a class="deck-link" href="${presentation.href}">查看演示</a>${pdfLink}
  </div>
</article>`
}

function formatUpdatedAt() {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date())
}

function formatName(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}
