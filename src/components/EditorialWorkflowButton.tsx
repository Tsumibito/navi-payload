'use client'

import { Button, useDocumentInfo, useForm } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

type Action = 'editorial' | 'translations' | 'taxonomy' | 'image' | 'full' | 'publish'
type Status = { publicationStatus?: string; workflow?: { state?: string; completedLocales?: string[]; lastError?: string }; errors?: string[] }
const actions: Array<{ action: Action; eyebrow: string; title: string; text: string }> = [
  { action: 'editorial', eyebrow: '01 · Current language', title: 'Generate editorial fields', text: 'Summary, SEO title, description, keyphrase, JSON-LD, FAQ and image alt.' },
  { action: 'translations', eyebrow: '02 · Locales', title: 'Generate translations', text: 'Create or regenerate Ukrainian, Russian and English versions with yachting terminology.' },
  { action: 'taxonomy', eyebrow: '03 · Topic cluster', title: 'Build tags and links', text: 'Select existing tags and create outgoing and incoming thematic link plans.' },
  { action: 'image', eyebrow: '04 · Hero', title: 'Generate image', text: 'Use the Hero image prompt. Enable regeneration to replace the current image.' },
]

export function EditorialWorkflowButton() {
  const { id } = useDocumentInfo()
  const { submit } = useForm()
  const [active, setActive] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status>({})

  const refresh = useCallback(async () => {
    if (!id) return
    const response = await fetch(`/api/editorial-workflow?postId=${id}`)
    if (response.ok) setStatus(await response.json())
  }, [id])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!['queued', 'running'].includes(status.workflow?.state || '')) return
    const timer = window.setInterval(() => { void refresh() }, 6000)
    return () => window.clearInterval(timer)
  }, [refresh, status.workflow?.state])

  const run = async (action: Action) => {
    if (!id || active) return
    if (action === 'publish' && !window.confirm('Опубликовать статью и открыть её для SSG?')) return
    setActive(action); setError(''); setMessage('Сохраняю текущие изменения…')
    try {
      const saved = await submit()
      if (saved && !saved.res.ok) throw new Error('Не удалось сохранить запись')
      setMessage(action === 'publish' ? 'Проверяю готовность…' : 'Ставлю задачу в очередь…')
      const response = await fetch('/api/editorial-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: id, action }) })
      const body = await response.json()
      if (!response.ok) throw new Error([body.error, ...(body.errors || [])].filter(Boolean).join(' · '))
      setMessage(action === 'publish' ? 'Статья опубликована.' : 'Задача запущена. Можно продолжать редактирование — результат появится после обработки.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выполнить действие')
    } finally { setActive(null) }
  }

  if (!id) return <p>Сначала сохраните новую статью.</p>
  const workflowState = status.workflow?.state || 'idle'
  const publication = status.publicationStatus || 'draft'
  return (
    <section style={{ margin: '0 0 24px', border: '1px solid var(--theme-elevation-150)', borderRadius: 12, overflow: 'hidden', background: 'var(--theme-elevation-0)' }}>
      <header style={{ padding: '20px 22px', background: 'linear-gradient(120deg, #082f49, #075985 68%, #0e7490)', color: '#fff' }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>Navi editorial bridge</div><h3 style={{ margin: '5px 0 4px', fontSize: 24 }}>Publication control</h3><p style={{ margin: 0, maxWidth: 720, opacity: .82 }}>Work through individual stages, or run the complete preparation. Publishing is always a separate action.</p></div>
          <div style={{ display: 'flex', gap: 7 }}><span style={{ padding: '6px 10px', borderRadius: 999, background: '#ffffff18' }}>Workflow: {workflowState}</span><span style={{ padding: '6px 10px', borderRadius: 999, background: publication === 'published' ? '#16a34a' : '#f59e0b', color: publication === 'published' ? '#fff' : '#1c1917' }}>{publication}</span></div>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', borderBottom: '1px solid var(--theme-elevation-150)' }}>
        {actions.map((item) => <div key={item.action} style={{ padding: 18, borderRight: '1px solid var(--theme-elevation-150)', minHeight: 174 }}>
          <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#0e7490', fontWeight: 700 }}>{item.eyebrow}</div>
          <h4 style={{ margin: '8px 0 7px', fontSize: 16 }}>{item.title}</h4><p style={{ minHeight: 48, margin: '0 0 14px', color: 'var(--theme-elevation-600)', lineHeight: 1.45 }}>{item.text}</p>
          <Button type="button" size="small" buttonStyle="secondary" disabled={Boolean(active)} onClick={() => run(item.action)}>{active === item.action ? 'Running…' : item.title}</Button>
        </div>)}
      </div>
      <footer style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--theme-elevation-50)' }}>
        <div><strong>{message || 'Ready for the next editorial action.'}</strong>{error && <div style={{ color: 'var(--theme-error-500)', marginTop: 5 }}>{error}</div>}{status.workflow?.lastError && <div style={{ color: 'var(--theme-error-500)', marginTop: 5 }}>Last workflow error: {status.workflow.lastError}</div>}</div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><Button type="button" disabled={Boolean(active)} onClick={() => run('full')}>{active === 'full' ? 'Preparing…' : 'Prepare everything'}</Button><Button type="button" buttonStyle="secondary" disabled={Boolean(active) || publication !== 'ready'} onClick={() => run('publish')}>Publish</Button></div>
      </footer>
    </section>
  )
}

export default EditorialWorkflowButton
