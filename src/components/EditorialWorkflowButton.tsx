'use client'

import { Button, useDocumentInfo, useForm } from '@payloadcms/ui'
import React, { useState } from 'react'

type State = 'idle' | 'saving' | 'queued' | 'error'

export function EditorialWorkflowButton() {
  const { id } = useDocumentInfo()
  const { submit } = useForm()
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  const run = async () => {
    if (!id || state === 'saving') return
    setState('saving')
    setMessage('Сохраняю изменения…')
    try {
      const saved = await submit()
      if (saved && !saved.res.ok) throw new Error('Не удалось сохранить запись')
      setMessage('Ставлю подготовку в очередь…')
      const response = await fetch('/api/editorial-workflow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: id }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Не удалось запустить workflow')
      setState('queued')
      setMessage('Workflow запущен. Статус изменится на ready после всех проверок; публикации не будет.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Неизвестная ошибка')
    }
  }

  if (!id) return <p>Сначала сохраните новую статью.</p>
  return (
    <div style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--theme-elevation-150)', borderRadius: '8px' }}>
      <Button type="button" onClick={run} disabled={state === 'saving'} buttonStyle="primary">
        {state === 'saving' ? 'Запускаю…' : state === 'queued' ? 'Запущено' : 'Подготовить к публикации'}
      </Button>
      <p style={{ margin: '8px 0 0', color: state === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-600)' }}>
        {message || 'Gemini: перевод и редактура. GLM: теги и перелинковка. Hero image: по промпту. Результат: ready, не published.'}
      </p>
    </div>
  )
}

export default EditorialWorkflowButton
