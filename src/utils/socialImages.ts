import sharp from 'sharp'

type SocialVariant = {
  field: 'thumbnail' | 'image16x9' | 'image5x4'
  label: string
  width: number
  height: number
  titleSize: number
  maxChars: number
  maxLines: number
}

export type SocialImageField = SocialVariant['field']

const VARIANTS: SocialVariant[] = [
  { field: 'thumbnail', label: 'square', width: 1080, height: 1080, titleSize: 70, maxChars: 25, maxLines: 4 },
  { field: 'image16x9', label: 'wide', width: 1200, height: 675, titleSize: 58, maxChars: 36, maxLines: 3 },
  // The legacy field is named image5x4, but n8n uses it as the portrait feed asset.
  { field: 'image5x4', label: 'portrait', width: 1080, height: 1350, titleSize: 72, maxChars: 24, maxLines: 4 },
]

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

function wrapTitle(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const current = lines.at(-1)
    if (!current || (current.length + word.length + 1 > maxChars && lines.length < maxLines)) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  if (lines.length > maxLines) lines.length = maxLines
  const consumed = lines.join(' ').length
  if (consumed < value.replace(/\s+/g, ' ').trim().length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1)!.replace(/[\s.,;:!?—-]+$/u, '')}…`
  }
  return lines
}

function overlaySvg(variant: SocialVariant, title: string): Buffer {
  const { width, height, titleSize, maxChars, maxLines } = variant
  const pad = Math.round(width * 0.065)
  const lines = wrapTitle(title, maxChars, maxLines)
  const lineHeight = Math.round(titleSize * 1.1)
  const titleHeight = lines.length * lineHeight
  const titleTop = height - pad - titleHeight - Math.round(height * 0.07)
  const brandSize = Math.max(25, Math.round(width * 0.026))
  const lineMarkup = lines.map((line, index) => `<text x="${pad}" y="${titleTop + (index + 1) * lineHeight}" class="title">${escapeXml(line)}</text>`).join('')
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#03131d" stop-opacity="0.08"/>
          <stop offset="0.42" stop-color="#03131d" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#03131d" stop-opacity="0.94"/>
        </linearGradient>
        <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffb14e"/>
          <stop offset="1" stop-color="#f27c22"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000" flood-opacity="0.55"/>
        </filter>
        <style>
          .brand { font: 700 ${brandSize}px Arial, Helvetica, sans-serif; letter-spacing: 1.4px; fill: #fff; }
          .kicker { font: 700 ${Math.round(brandSize * 0.56)}px Arial, Helvetica, sans-serif; letter-spacing: 3px; fill: #fff; opacity: .78; }
          .title { font: 700 ${titleSize}px Arial, Helvetica, sans-serif; letter-spacing: -1.2px; fill: #fff; filter: url(#shadow); }
        </style>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <g transform="translate(${pad} ${pad})">
        <path d="M0 28 L22 0 L44 28 L22 47 Z" fill="url(#brand)"/>
        <path d="M22 8 L22 35 L8 28 Z" fill="#fff" fill-opacity=".9"/>
        <path d="M25 13 L37 28 L25 30 Z" fill="#0e7490"/>
        <text x="58" y="28" class="brand">NAVI.TRAINING</text>
        <text x="59" y="50" class="kicker">SAILING · TRAINING · TRAVEL</text>
      </g>
      <rect x="${pad}" y="${titleTop - 24}" width="86" height="7" rx="3.5" fill="url(#brand)"/>
      ${lineMarkup}
    </svg>
  `)
}

function relationId(value: any): string | number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object') return value
  if ('value' in value) return relationId(value.value)
  return value.id
}

async function loadSourceImage(payload: any, image: any): Promise<Buffer> {
  const id = relationId(image)
  const media = typeof image === 'object' && image?.url
    ? image
    : id != null ? await payload.findByID({ collection: 'media', id, depth: 0 }) : null
  if (!media?.url) throw new Error('Featured image has no public URL')
  const response = await fetch(media.url)
  if (!response.ok) throw new Error(`Featured image download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 1_000) throw new Error('Featured image is empty')
  return bytes
}

export async function renderPostSocialImage(source: Buffer, title: string, field: SocialImageField): Promise<Buffer> {
  const variant = VARIANTS.find((candidate) => candidate.field === field)
  if (!variant) throw new Error(`Unknown social image field: ${field}`)
  return sharp(source)
    .rotate()
    .resize(variant.width, variant.height, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.96, saturation: 1.04 })
    .composite([{ input: overlaySvg(variant, title), top: 0, left: 0 }])
    .webp({ quality: 90, smartSubsample: true })
    .toBuffer()
}

export async function generatePostSocialImages(payload: any, post: any) {
  if (!post?.image) throw new Error('Generate or select a Featured Image before Social Images')
  const source = await loadSourceImage(payload, post.image)
  const generated: Record<string, any> = {}

  for (const variant of VARIANTS) {
    const data = await renderPostSocialImage(source, post.name, variant.field)
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${post.name} — Navi.training social ${variant.label}` },
      file: {
        data,
        mimetype: 'image/webp',
        name: `social-post-${post.id}-${variant.label}-${Date.now()}.webp`,
        size: data.length,
      },
    })
    generated[variant.field] = media
  }

  return {
    thumbnail: generated.thumbnail,
    image16x9: generated.image16x9,
    image5x4: generated.image5x4,
  }
}
