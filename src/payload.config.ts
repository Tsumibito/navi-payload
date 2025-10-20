import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tags } from './content/Tags'
import { Team } from './content/Team'
import { Posts } from './content/Posts'
import { Certificates } from './collections/Certificates'
import { Trainings } from './content/Trainings'
import { SiteGlobals } from './globals/SiteGlobals'
import { Redirects } from './collections/Redirects'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      autoGenerate: false,
    },
  },
  defaultDepth: 1,
  collections: [Users, Media, Redirects, Posts, Tags, Team, Certificates, Trainings],
  globals: [SiteGlobals],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Нативная локализация Payload для новых коллекций (TagsNew и далее)
  // Старые коллекции (Tags, Posts и т.д.) продолжают использовать translations array
  localization: {
    locales: ['ru', 'uk', 'en'],
    defaultLocale: 'ru',
    fallback: true,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: false,
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename }) =>
            `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${filename}`,
          prefix: '',
        },
      },
      bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? '',
      config: {
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
        },
      },
      clientUploads: false,
    }),
  ],
  graphQL: {
    disable: true,
  },
})
