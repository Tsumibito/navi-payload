'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

type Action = 'editorial' | 'translations' | 'taxonomy' | 'image' | 'social' | 'full' | 'publish'
type Status = {
  publicationStatus?: string
  workflow?: { state?: string; currentStage?: string; completedLocales?: string[]; lastError?: string }
  assets?: { hero?: boolean; social?: Record<string, boolean> }
  errors?: string[]
}
const actions: Array<{ action: Action; eyebrow: string; title: string; text: string; asset?: 'hero' | 'social' }> = [
  { action: 'editorial', eyebrow: 'Current language', title: 'Generate editorial fields', text: 'Summary, SEO title, description, keyphrase, JSON-LD, FAQ and image alt.' },
  { action: 'translations', eyebrow: 'Languages', title: 'Generate translations', text: 'Create Ukrainian, Russian and English versions with yachting terminology.' },
  { action: 'taxonomy', eyebrow: 'Topic cluster', title: 'Build tags and links', text: 'Select tags and prepare outgoing and incoming thematic links.' },
  { action: 'image', eyebrow: 'Optional · Hero', title: 'Generate image', text: 'Automatic when no Featured Image exists. Use this action only to create or deliberately replace it.', asset: 'hero' },
  { action: 'social', eyebrow: 'Automatic · Distribution', title: 'Generate social images', text: 'One localized square, wide and portrait set for each language. Prepare everything creates missing sets automatically.', asset: 'social' },
]

export function EditorialWorkflowButton() {
  const documentInfo = useDocumentInfo()
  const { id } = documentInfo
  const [active, setActive] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status>({})
  const currentLocale = (() => {
    const fromInfo = (documentInfo as any)?.locale?.code || (documentInfo as any)?.localeCode || (documentInfo as any)?.locale
    const fromURL = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locale') : null
    const value = String(fromURL || fromInfo || 'ru').toLowerCase()
    return value === 'ua' ? 'uk' : value
  })()

  const refresh = useCallback(async () => {
    if (!id) return
    const response = await fetch(`/api/editorial-workflow?postId=${id}`, { cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as Status
    setStatus(next)
    const nextState = next.workflow?.state || 'idle'
    if (nextState === 'queued' || nextState === 'running') setMessage(next.workflow?.currentStage || 'Workflow is running…')
    if (nextState === 'review') setMessage('Ready for the next editorial action.')
    if (nextState === 'failed') setMessage('Workflow stopped. See the exact failing stage below.')
  }, [id])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!['queued', 'running'].includes(status.workflow?.state || '')) return
    const timer = window.setInterval(() => { void refresh() }, 3000)
    return () => window.clearInterval(timer)
  }, [refresh, status.workflow?.state])

  const run = async (action: Action) => {
    if (!id || active) return
    if (action === 'publish' && !window.confirm('Опубликовать статью и открыть её для SSG?')) return
    setActive(action); setError(''); setMessage('Запускаю действие для последней сохранённой версии…')
    try {
      setMessage(action === 'publish' ? 'Проверяю готовность…' : 'Ставлю задачу в очередь…')
      const response = await fetch('/api/editorial-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: id, action, locale: currentLocale }) })
      const body = await response.json()
      if (!response.ok) throw new Error([body.error, ...(body.errors || [])].filter(Boolean).join(' · '))
      setMessage(body.completed ? 'Поля записаны. Обновляю форму…' : action === 'publish' ? 'Статья опубликована.' : 'Задача запущена. Результат появится после обработки.')
      if (body.completed) { window.location.reload(); return }
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выполнить действие')
    } finally { setActive(null) }
  }

  if (!id) return <p>Сначала сохраните новую статью.</p>
  const workflowState = status.workflow?.state || 'idle'
  const publication = status.publicationStatus || 'draft'
  const workflowBusy = Boolean(active) || ['queued', 'running'].includes(workflowState)
  const socialReadyCount = ['ru', 'uk', 'en'].filter((locale) => status.assets?.social?.[locale]).length
  return (
    <section style={{ margin: '0 0 24px', border: '1px solid var(--theme-elevation-150)', borderRadius: 12, overflow: 'hidden', background: 'var(--theme-elevation-0)' }}>
      <header style={{ padding: '20px 22px', background: 'linear-gradient(120deg, #082f49, #075985 68%, #0e7490)', color: '#fff' }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>Navi editorial bridge</div><h3 style={{ margin: '5px 0 4px', fontSize: 24 }}>Publication control</h3><p style={{ margin: 0, maxWidth: 720, opacity: .82 }}>Actions use the last saved article version. Save manual edits first. Publishing is always a separate action.</p></div>
          <div style={{ display: 'flex', gap: 7 }}><span style={{ padding: '6px 10px', borderRadius: 999, background: '#ffffff18' }}>Workflow: {workflowState}</span><span style={{ padding: '6px 10px', borderRadius: 999, background: publication === 'published' ? '#16a34a' : '#f59e0b', color: publication === 'published' ? '#fff' : '#1c1917' }}>{publication}</span></div>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', borderBottom: '1px solid var(--theme-elevation-150)' }}>
        {actions.map((item) => {
          const ready = item.asset === 'hero' ? Boolean(status.assets?.hero) : item.asset === 'social' ? socialReadyCount === 3 : false
          return <div key={item.action} style={{ padding: 18, borderRight: '1px solid var(--theme-elevation-150)', minHeight: 190 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#0e7490', fontWeight: 700 }}>{item.eyebrow}</span>{item.asset && <span style={{ padding: '3px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: ready ? '#dcfce7' : '#fef3c7', color: ready ? '#166534' : '#92400e' }}>{item.asset === 'social' ? `${socialReadyCount}/3 languages` : ready ? 'Ready' : 'Missing'}</span>}</div>
          <h4 style={{ margin: '8px 0 7px', fontSize: 16 }}>{item.title}</h4><p style={{ minHeight: 48, margin: '0 0 14px', color: 'var(--theme-elevation-600)', lineHeight: 1.45 }}>{item.text}</p>
          <Button type="button" size="small" buttonStyle="secondary" disabled={workflowBusy} onClick={() => run(item.action)}>{active === item.action ? 'Running…' : ready ? `Regenerate ${item.asset === 'hero' ? 'hero' : 'all languages'}` : item.title}</Button>
        </div>})}
      </div>
      <footer style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--theme-elevation-50)' }}>
        <div><strong>{message || 'Ready for the next editorial action.'}</strong>{['queued', 'running'].includes(workflowState) && <div style={{ marginTop: 7, fontSize: 12, color: 'var(--theme-elevation-600)' }}>Live status refreshes automatically every 3 seconds.</div>}{status.workflow?.completedLocales?.length ? <div style={{ marginTop: 7, fontSize: 12, color: 'var(--theme-elevation-600)' }}>Completed languages: {status.workflow.completedLocales.map((locale) => locale.toUpperCase()).join(' · ')}</div> : null}{error && <div style={{ color: 'var(--theme-error-500)', marginTop: 5 }}>{error}</div>}{status.workflow?.lastError && <div style={{ color: 'var(--theme-error-500)', marginTop: 5 }}>Last workflow error: {status.workflow.lastError}</div>}</div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><Button type="button" disabled={workflowBusy} onClick={() => run('full')}>{active === 'full' ? 'Preparing…' : 'Prepare everything'}</Button><Button type="button" buttonStyle="secondary" disabled={workflowBusy || publication !== 'ready'} onClick={() => run('publish')}>Publish</Button></div>
      </footer>
    </section>
  )
}

export default EditorialWorkflowButton
