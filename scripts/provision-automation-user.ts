import config from '@payload-config'
import { getPayload } from 'payload'

const email = process.env.AUTOMATION_USER_EMAIL?.trim() || 'codex@navi.training'
const apiKey = process.env.AUTOMATION_USER_API_KEY?.trim()
const password = process.env.AUTOMATION_USER_PASSWORD?.trim()

if (!apiKey || apiKey.length < 32) throw new Error('AUTOMATION_USER_API_KEY must contain at least 32 characters')
if (!password || password.length < 20) throw new Error('AUTOMATION_USER_PASSWORD must contain at least 20 characters')

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
const data = { email, password, role: 'automation' as const, enableAPIKey: true, apiKey }
const user = existing.docs[0]
  ? await payload.update({ collection: 'users', id: existing.docs[0].id, data, overrideAccess: true })
  : await payload.create({ collection: 'users', data, overrideAccess: true })

payload.logger.info({ userId: user.id, email, role: user.role }, 'Automation API user provisioned')
process.exit(0)
