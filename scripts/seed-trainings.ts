#!/usr/bin/env tsx
/**
 * Idempotently seed the public course routes and their ordered certificate tabs.
 *
 * This intentionally models course pages only. `/sailing-school/` is a landing
 * page and continues to render the full certificate collection; it is not a
 * Training record.
 *
 * Safety: this script is dry-run by default. Pass `--apply` to mutate the
 * configured database. Environment variables must be loaded explicitly by the
 * caller (for production: `dotenvx run -f .env.production -- ...`).
 */

type Locale = 'ru' | 'uk' | 'en'

type TrainingSeed = {
  routeKey: string
  certificates: string[]
  locales: Record<Locale, { name: string; slug: string }>
}

const SEEDS: TrainingSeed[] = [
  {
    routeKey: 'inshore-skipper-sail',
    certificates: ['inshore-skipper-sail', 'vhf-src'],
    locales: {
      ru: { name: 'Inshore Skipper Sail', slug: 'inshore-skipper-sail' },
      uk: { name: 'Inshore Skipper Sail', slug: 'inshore-skipper-sail' },
      en: { name: 'Inshore Skipper Sail', slug: 'inshore-skipper-sail' },
    },
  },
]

const apply = process.argv.includes('--apply')

function ids(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => Number(typeof item === 'object' && item ? (item as { id: unknown }).id : item))
}

function sameIds(left: unknown, right: number[]): boolean {
  const current = ids(left)
  return current.length === right.length && current.every((id, index) => id === right[index])
}

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  if (!process.env.PAYLOAD_SECRET) throw new Error('PAYLOAD_SECRET is required')

  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })

  const certificateIds = new Map<string, number>()
  const certificates = await payload.find({
    collection: 'certificates',
    locale: 'en',
    fallbackLocale: false,
    limit: 100,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    draft: true,
  })

  for (const certificate of certificates.docs) {
    if (certificate.slug) certificateIds.set(certificate.slug, certificate.id)
  }

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const seed of SEEDS) {
    const orderedCertificateIds = seed.certificates.map((slug) => {
      const id = certificateIds.get(slug)
      if (!id) throw new Error(`Certificate not found: ${slug}`)
      return id
    })

    const found = await payload.find({
      collection: 'trainings',
      locale: 'en',
      fallbackLocale: false,
      where: { slug: { equals: seed.locales.en.slug } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
      draft: true,
    })

    if (found.docs.length > 1) throw new Error(`Duplicate training route: ${seed.routeKey}`)

    let trainingId = found.docs[0]?.id
    if (!trainingId) {
      console.log(`[${apply ? 'apply' : 'dry-run'}] create ${seed.routeKey} -> ${seed.certificates.join(', ')}`)
      if (!apply) continue
      const createdTraining = await payload.create({
        collection: 'trainings',
        locale: 'ru',
        data: {
          ...seed.locales.ru,
          certificates: orderedCertificateIds,
          _status: 'published',
        },
        draft: false,
        overrideAccess: true,
      })
      trainingId = createdTraining.id
      created += 1
    } else if (!sameIds(found.docs[0].certificates, orderedCertificateIds)) {
      console.log(`[${apply ? 'apply' : 'dry-run'}] certificates ${seed.routeKey} -> ${seed.certificates.join(', ')}`)
      if (apply) {
        await payload.update({
          collection: 'trainings',
          id: trainingId,
          locale: 'ru',
          data: { certificates: orderedCertificateIds, _status: 'published' },
          draft: false,
          overrideAccess: true,
        })
        updated += 1
      }
    }

    if (!apply || !trainingId) continue

    for (const locale of ['ru', 'uk', 'en'] as Locale[]) {
      const current = await payload.findByID({
        collection: 'trainings',
        id: trainingId,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        draft: true,
      })
      const expected = seed.locales[locale]
      const localeChanged = current.name !== expected.name || current.slug !== expected.slug
      const relationChanged = !sameIds(current.certificates, orderedCertificateIds)
      if (!localeChanged && !relationChanged && current._status === 'published') continue

      await payload.update({
        collection: 'trainings',
        id: trainingId,
        locale,
        data: {
          ...expected,
          certificates: orderedCertificateIds,
          _status: 'published',
        },
        draft: false,
        overrideAccess: true,
      })
      updated += 1
    }

    if (!updated && !created) unchanged += 1
  }

  console.log(
    apply
      ? `Training seed complete: ${created} created, ${updated} updates, ${unchanged} unchanged.`
      : 'Dry run complete. Re-run with --apply to write changes.',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
