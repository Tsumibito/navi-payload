import { postgresAdapter } from '@payloadcms/db-postgres'
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
import { Pages } from './content/Pages'
import { env } from './config/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname, '..'),
      autoGenerate: false,
    },
  },
  serverURL: env.serverUrl,
  cors: [env.serverUrl],
  csrf: [env.serverUrl],
  defaultDepth: 0,
  collections: [Users, Media, Redirects, Pages, Posts, Tags, Team, Certificates, Trainings],
  globals: [SiteGlobals],
  editor: lexicalEditor(),
  secret: env.payloadSecret,
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
    schemaName: env.databaseSchema,
    pool: {
      connectionString: env.databaseUri,
      ...env.databasePool,
    },
    push: false,
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename }) =>
            `${env.r2.publicUrl}/${filename}`,
          prefix: '',
        },
      },
      bucket: env.r2.bucket,
      config: {
        endpoint: env.r2.endpoint,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.r2.accessKeyId,
          secretAccessKey: env.r2.secretAccessKey,
        },
      },
      clientUploads: false,
    }),
  ],
  graphQL: {
    disable: true,
  },
})
