type Locale = 'ru' | 'uk' | 'en'
type ServiceKey = 'charter' | 'yacht-delivery' | 'yacht-expertise' | 'sailing-school' | 'general'

type Mail = {
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
  textContent: string
  replyTo?: { email: string; name?: string }
}

export type LeadMailData = {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  message?: string
  service?: string
  locale?: string
  sourceUrl?: string
}

const palette = {
  sea: '#073746', ink: '#294f5a', muted: '#71858b', mist: '#eef4f3', white: '#ffffff', orange: '#d97706', orangeLight: '#f1a23c',
}

const localeOf = (value?: string): Locale => value === 'uk' || value === 'ua' ? 'uk' : value === 'en' ? 'en' : 'ru'
const escapeHtml = (value?: string) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
const nameOf = (data: LeadMailData) => [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
const siteLocale = (locale: Locale) => locale === 'uk' ? 'ua' : locale

const serviceOf = (value?: string): ServiceKey => {
  const key = String(value || '').toLowerCase()
  if (key.includes('delivery')) return 'yacht-delivery'
  if (key.includes('expert')) return 'yacht-expertise'
  if (key.includes('charter') || key.includes('rent')) return 'charter'
  if (key.includes('school') || key.includes('course') || key.includes('training')) return 'sailing-school'
  return 'general'
}

const serviceCopy: Record<ServiceKey, Record<Locale, { label: string; customerTitle: string; customerBody: string; action: string; path: string }>> = {
  charter: {
    ru: { label: 'Аренда яхты и путешествие', customerTitle: 'Начинаем планировать путешествие', customerBody: 'Спасибо за заявку. Мы уточним состав экипажа, даты и желаемую акваторию, после чего предложим подходящие варианты.', action: 'Посмотреть чартер', path: 'charter' },
    uk: { label: 'Оренда яхти та подорож', customerTitle: 'Починаємо планувати подорож', customerBody: 'Дякуємо за заявку. Ми уточнимо склад екіпажу, дати й бажану акваторію, після чого запропонуємо відповідні варіанти.', action: 'Переглянути чартер', path: 'charter' },
    en: { label: 'Yacht charter and travel', customerTitle: 'Let us start planning your voyage', customerBody: 'Thank you for your request. We will confirm the crew, dates and preferred cruising area, then suggest suitable options.', action: 'Explore charter', path: 'charter' },
  },
  'yacht-delivery': {
    ru: { label: 'Перегон яхты', customerTitle: 'Маршрут принят в работу', customerBody: 'Спасибо. Мы изучим данные яхты, точки маршрута и сроки, затем свяжемся с вами для предметного обсуждения перехода.', action: 'О перегоне яхт', path: 'yacht-delivery' },
    uk: { label: 'Перегін яхти', customerTitle: 'Маршрут прийнято в роботу', customerBody: 'Дякуємо. Ми вивчимо дані яхти, точки маршруту й терміни, а потім зв’яжемося з вами для предметного обговорення переходу.', action: 'Про перегін яхт', path: 'yacht-delivery' },
    en: { label: 'Yacht delivery', customerTitle: 'Your passage is on our chart', customerBody: 'Thank you. We will review the yacht, route and timing, then contact you to discuss a realistic passage plan.', action: 'About yacht delivery', path: 'yacht-delivery' },
  },
  'yacht-expertise': {
    ru: { label: 'Подбор и экспертиза яхты', customerTitle: 'Запрос на экспертизу получен', customerBody: 'Спасибо. Мы изучим модель яхты, этап сделки и будущую акваторию, чтобы первая консультация была предметной.', action: 'Об экспертизе яхт', path: 'yacht-expertise' },
    uk: { label: 'Підбір та експертиза яхти', customerTitle: 'Запит на експертизу отримано', customerBody: 'Дякуємо. Ми вивчимо модель яхти, етап угоди та майбутню акваторію, щоб перша консультація була предметною.', action: 'Про експертизу яхт', path: 'yacht-expertise' },
    en: { label: 'Yacht selection and expertise', customerTitle: 'Your consultation request is received', customerBody: 'Thank you. We will review the yacht model, purchase stage and intended cruising area so our first conversation is useful.', action: 'About yacht expertise', path: 'yacht-expertise' },
  },
  'sailing-school': {
    ru: { label: 'Яхтенная школа', customerTitle: 'Заявка на обучение получена', customerBody: 'Спасибо. Мы уточним ваш опыт, цели и удобные даты, затем предложим подходящий формат обучения.', action: 'О яхтенной школе', path: 'sailing-school' },
    uk: { label: 'Яхтова школа', customerTitle: 'Заявку на навчання отримано', customerBody: 'Дякуємо. Ми уточнимо ваш досвід, цілі та зручні дати, а потім запропонуємо відповідний формат навчання.', action: 'Про яхтову школу', path: 'sailing-school' },
    en: { label: 'Sailing school', customerTitle: 'Your training request is received', customerBody: 'Thank you. We will confirm your experience, goals and preferred dates, then suggest the right training format.', action: 'About the sailing school', path: 'sailing-school' },
  },
  general: {
    ru: { label: 'Общее обращение', customerTitle: 'Заявка принята', customerBody: 'Спасибо. Мы изучим ваш запрос и свяжемся с вами в ближайшее время.', action: 'Открыть Navi.training', path: '' },
    uk: { label: 'Загальне звернення', customerTitle: 'Заявку прийнято', customerBody: 'Дякуємо. Ми розглянемо ваш запит і зв’яжемося з вами найближчим часом.', action: 'Відкрити Navi.training', path: '' },
    en: { label: 'General enquiry', customerTitle: 'Request received', customerBody: 'Thank you. We will review your request and get in touch with you shortly.', action: 'Open Navi.training', path: '' },
  },
}

const sender = () => ({ email: process.env.BREVO_SENDER_EMAIL || 'info@navi.training', name: process.env.BREVO_SENDER_NAME || 'Navi.training' })
const actionButton = (href: string, label: string) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px"><tr><td style="border-radius:8px;background:${palette.orange}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;color:${palette.white};text-decoration:none;font:700 15px/1 Arial,sans-serif">${escapeHtml(label)}</a></td></tr></table>`

const emailShell = ({ title, eyebrow, content, action, preheader }: { title: string; eyebrow: string; content: string; action?: { href: string; label: string }; preheader: string }) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width"><style>@media(max-width:640px){.navi-card{border-radius:14px!important}.navi-pad{padding-left:24px!important;padding-right:24px!important}.navi-title{font-size:30px!important}.navi-meta td{display:block!important;padding:4px 0!important}}</style></head>
<body style="margin:0;background:${palette.mist};font-family:Arial,sans-serif;color:${palette.sea}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${palette.mist};padding:28px 12px"><tr><td align="center">
<table class="navi-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${palette.white};border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(7,55,70,.12)">
<tr><td style="height:8px;background:${palette.orange}"></td></tr>
<tr><td class="navi-pad" style="padding:38px 42px 16px"><div style="font:700 12px/1.4 monospace;letter-spacing:.16em;text-transform:uppercase;color:${palette.orange}">${escapeHtml(eyebrow)}</div><h1 class="navi-title" style="margin:12px 0 0;font:400 36px/1.12 Georgia,serif;color:${palette.sea}">${escapeHtml(title)}</h1></td></tr>
<tr><td class="navi-pad" style="padding:8px 42px 36px;font:16px/1.65 Arial,sans-serif;color:${palette.ink}">${content}${action ? actionButton(action.href, action.label) : ''}</td></tr>
<tr><td class="navi-pad" style="padding:22px 42px;background:${palette.sea};color:#d9e8e9;font:12px/1.6 Arial,sans-serif">Navi.training · La Rochelle<br><span style="color:${palette.orangeLight};font-family:monospace">46.1603° N · 1.1511° W</span></td></tr>
</table></td></tr></table></body></html>`

async function send(mail: Mail) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ sender: sender(), ...mail }) })
  if (!response.ok) throw new Error(`Brevo email failed with status ${response.status}`)
}

export async function syncBrevoSubscriber(data: Pick<LeadMailData, 'email' | 'firstName' | 'lastName'>) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  const listId = Number(process.env.BREVO_SUBSCRIBERS_LIST_ID)
  const attributes = Object.fromEntries([['FIRSTNAME', data.firstName], ['LASTNAME', data.lastName]].filter(([, value]) => value))
  const response = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: data.email, attributes, updateEnabled: true, ...(Number.isInteger(listId) && listId > 0 ? { listIds: [listId] } : {}) }) })
  if (!response.ok) throw new Error(`Brevo contact sync failed with status ${response.status}`)
}

export async function sendLeadEmails(data: LeadMailData) {
  const locale = localeOf(data.locale)
  const service = serviceCopy[serviceOf(data.service)][locale]
  const name = nameOf(data)
  const notificationEmail = process.env.LEAD_NOTIFICATION_EMAIL || 'alex@navi.training'
  const fields = [['Имя / Name', name], ['Email', data.email], ['Телефон / Phone', data.phone], ['Услуга / Service', service.label], ['Язык / Language', locale], ['Сообщение / Message', data.message], ['Источник / Source', data.sourceUrl]].filter(([, value]) => value)
  const rows = fields.map(([label, value]) => `<tr><td style="padding:8px 16px 8px 0;color:${palette.muted};vertical-align:top;font-size:13px">${escapeHtml(label)}</td><td style="padding:8px 0;color:${palette.sea};white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join('')
  const customerUrl = `https://navi.training/${siteLocale(locale)}/${service.path ? `${service.path}/` : ''}`

  await Promise.all([
    send({
      to: [{ email: notificationEmail, name: 'Alex' }], replyTo: { email: data.email, name: name || data.email },
      subject: `[${service.label}] ${name || data.email}`,
      htmlContent: emailShell({ title: service.label, eyebrow: 'Новая заявка · New lead', preheader: `${name || data.email}: ${service.label}`, content: `<table class="navi-meta" role="presentation" cellspacing="0" cellpadding="0" width="100%">${rows}</table>`, action: { href: `mailto:${encodeURIComponent(data.email)}`, label: 'Ответить клиенту' } }),
      textContent: `${service.label}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}`,
    }),
    send({
      to: [{ email: data.email, name: name || undefined }], subject: service.customerTitle,
      htmlContent: emailShell({ title: service.customerTitle, eyebrow: 'Navi.training', preheader: service.customerBody, content: `<p style="margin:0">${escapeHtml(service.customerBody)}</p><p style="margin:18px 0 0;color:${palette.muted};font-size:14px">${escapeHtml(locale === 'en' ? 'We usually reply within one business day.' : locale === 'uk' ? 'Зазвичай ми відповідаємо протягом одного робочого дня.' : 'Обычно мы отвечаем в течение одного рабочего дня.')}</p>`, action: { href: customerUrl, label: service.action } }),
      textContent: `${service.customerTitle}\n\n${service.customerBody}\n\n${customerUrl}`,
    }),
  ])
}

export async function sendSubscriberEmails(data: Pick<LeadMailData, 'email' | 'firstName' | 'lastName' | 'locale' | 'sourceUrl'>) {
  const locale = localeOf(data.locale)
  const name = nameOf(data)
  const customer = {
    ru: { subject: 'Вы подписаны на новости Navi.training', title: 'Добро пожаловать на борт', body: 'Вы подписаны на новости для тех, кого зовёт море. Будем присылать новые маршруты, истории и полезные материалы без лишнего шума.', action: 'Читать журнал' },
    uk: { subject: 'Ви підписані на новини Navi.training', title: 'Ласкаво просимо на борт', body: 'Ви підписані на новини для тих, кого кличе море. Надсилатимемо нові маршрути, історії та корисні матеріали без зайвого шуму.', action: 'Читати журнал' },
    en: { subject: 'You are subscribed to Navi.training news', title: 'Welcome aboard', body: 'You are subscribed to news for people drawn to the sea. Expect new routes, stories and useful guidance without the noise.', action: 'Read the journal' },
  }[locale]
  const notificationEmail = process.env.LEAD_NOTIFICATION_EMAIL || 'alex@navi.training'
  const blogUrl = `https://navi.training/${siteLocale(locale)}/blog/`

  await Promise.all([
    syncBrevoSubscriber(data),
    send({
      to: [{ email: notificationEmail, name: 'Alex' }], subject: `[Подписка] ${name || data.email}`,
      htmlContent: emailShell({ title: 'Новый подписчик', eyebrow: 'Бортовой журнал', preheader: `Новая подписка: ${data.email}`, content: `<p style="margin:0"><strong>${escapeHtml(name || data.email)}</strong><br><a href="mailto:${escapeHtml(data.email)}" style="color:${palette.orange}">${escapeHtml(data.email)}</a></p><p style="margin:18px 0 0;color:${palette.muted};font-size:13px">Источник: ${escapeHtml(data.sourceUrl)}</p>` }),
      textContent: `Новый подписчик\n\n${name || '-'}\n${data.email}\n${data.sourceUrl || '-'}`,
    }),
    send({
      to: [{ email: data.email, name: name || undefined }], subject: customer.subject,
      htmlContent: emailShell({ title: customer.title, eyebrow: 'Navi.training journal', preheader: customer.body, content: `<p style="margin:0">${escapeHtml(customer.body)}</p>`, action: { href: blogUrl, label: customer.action } }),
      textContent: `${customer.title}\n\n${customer.body}\n\n${blogUrl}`,
    }),
  ])
}
