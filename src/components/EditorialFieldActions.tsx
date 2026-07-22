'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

type Action = 'seo' | 'faq' | 'alt' | 'social'

function EditorialFieldAction({ action, label, description }: { action: Action; label: string; description: string }) {
  const info = useDocumentInfo()
  const [state, setState] = useState<'idle' | 'running' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const locale = (() => {
    const fromInfo = (info as any)?.locale?.code || (info as any)?.localeCode || (info as any)?.locale
    const fromURL = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locale') : null
    const value = String(fromURL || fromInfo || 'ru').toLowerCase()
    return value === 'ua' ? 'uk' : value
  })()

  const run = async () => {
    if (!info.id || state === 'running') return
    setState('running'); setMessage('Генерирую…')
    try {
      const response = await fetch('/api/editorial-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: info.id, action, locale }) })
      const body = await response.json()
      if (!response.ok) {
        const details = Array.isArray(body.errors) ? `: ${body.errors.join('; ')}` : ''
        throw new Error(`${body.error || 'Генерация не выполнена'}${details}`)
      }
      setMessage('Готово. Обновляю поля…')
      window.location.reload()
    } catch (error) {
      setState('error'); setMessage(error instanceof Error ? error.message : 'Ошибка генерации')
    }
  }

  return <div style={{ margin: '10px 0 16px', padding: '12px 14px', border: '1px solid var(--theme-elevation-150)', borderLeft: '3px solid #0e7490', borderRadius: 6, background: 'var(--theme-elevation-50)' }}>
    <button type="button" onClick={run} disabled={state === 'running'} style={{ border: 0, borderRadius: 5, padding: '8px 13px', cursor: state === 'running' ? 'wait' : 'pointer', background: '#075985', color: '#fff', fontWeight: 650 }}>{state === 'running' ? 'Generating…' : label}</button>
    <span style={{ marginLeft: 11, color: state === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-600)' }}>{message || description}</span>
  </div>
}

export const GenerateSeoFieldsButton = () => <EditorialFieldAction action="seo" label="Generate SEO fields" description="SEO title, description, focus keyphrase, link keywords and JSON-LD for the open language." />
export const GenerateFaqFieldsButton = () => <EditorialFieldAction action="faq" label="Generate FAQ" description="Create 4–6 useful FAQs in the open language and refresh FAQPage JSON-LD." />
export const GenerateImageAltButton = () => <EditorialFieldAction action="alt" label="Generate image alt" description="Create a concise localized alt text for the featured image." />
export const GenerateSocialImagesButton = () => <EditorialFieldAction action="social" label="Generate social images" description="Create branded square, wide and portrait assets from the Featured Image for n8n." />
