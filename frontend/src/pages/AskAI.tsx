import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiThumbsDown, FiThumbsUp, FiX } from 'react-icons/fi'
import { useAuth } from '../context/useAuth'
import { useAppState } from '../context/useAppState'
import { Pill } from '../components/ui'
import { cn } from '../lib/cn'
import { chatApi } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import {
  applyEvidenceScope,
  clarifySuggestions,
  evidenceLinks,
  evidencePeriodLabel,
  type EvidenceItem,
  type EvidenceLink,
} from '../lib/evidenceLinks'

type AskAIProps = {
  open: boolean
  onClose: () => void
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  toolFamily?: string | null
  dataStatus?: string | null
  evidence?: EvidenceItem[]
  feedback?: '' | 'up' | 'down'
  typing?: boolean
}

const SESSION_KEY = 'gp.askAi.sessionId'

function welcomeText(name: string | undefined) {
  const first = name?.trim().split(/\s+/)[0] || 'there'
  return `Good morning, ${first}. Ask me anything about your authorized locations, sales, costs, reviews, invoices or forecast. I answer only from your data.`
}

export function AskAI({ open, onClose }: AskAIProps) {
  const { user } = useAuth()
  const {
    query,
    setDatePreset,
    setCustomFrom,
    setCustomTo,
    setSelectedLocationId,
  } = useAppState()
  const navigate = useNavigate()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>(() => sessionStorage.getItem(SESSION_KEY) || undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [historyLoaded, setHistoryLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const stored = sessionStorage.getItem(SESSION_KEY) || undefined
    setHistoryLoaded(false)
    if (!stored) {
      setMessages([{ id: 'welcome', role: 'assistant', text: welcomeText(user?.name) }])
      setHistoryLoaded(true)
      return () => { cancelled = true }
    }
    chatApi.history(stored)
      .then((res) => {
        if (cancelled) return
        const rows = res.data.messages || []
        if (!rows.length) {
          setMessages([{ id: 'welcome', role: 'assistant', text: welcomeText(user?.name) }])
          return
        }
        setSessionId(stored)
        setMessages(rows.map((row) => ({
          id: String(row._id),
          role: row.role === 'user' ? 'user' : 'assistant',
          text: String(row.content || ''),
          toolFamily: row.toolFamily ? String(row.toolFamily) : null,
          evidence: Array.isArray(row.evidence) ? row.evidence as EvidenceItem[] : [],
          feedback: row.feedback === 'up' || row.feedback === 'down' ? row.feedback : '',
        })))
      })
      .catch(() => {
        if (cancelled) return
        setMessages([{ id: 'welcome', role: 'assistant', text: welcomeText(user?.name) }])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true)
      })
    return () => { cancelled = true }
  }, [open, user?.name])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, open, busy])

  if (!open) return null

  const firstName = (user?.name || 'there').split(/\s+/)[0] || 'there'

  const openEvidence = (link: EvidenceLink) => {
    applyEvidenceScope(link, { setDatePreset, setCustomFrom, setCustomTo, setSelectedLocationId })
    onClose()
    navigate(link.path)
  }

  const onSend = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    setError('')
    setBusy(true)
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== 'welcome' || prev.some((x) => x.role === 'user')),
      { id: `u-${Date.now()}`, role: 'user', text },
      { id: 'typing', role: 'assistant', text: '', typing: true },
    ])
    try {
      const res = await chatApi.ask({ question: text, sessionId, scope: query })
      sessionStorage.setItem(SESSION_KEY, res.data.sessionId)
      setSessionId(res.data.sessionId)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'typing'),
        {
          id: res.data.message._id,
          role: 'assistant',
          text: res.data.message.content,
          toolFamily: res.data.toolFamily,
          dataStatus: res.data.dataStatus,
          evidence: (res.data.evidence || []) as EvidenceItem[],
          feedback: '',
        },
      ])
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== 'typing'))
      setError(asyncMessage(err, 'Unable to answer from authorized data'))
    } finally {
      setBusy(false)
    }
  }

  const onFeedback = async (id: string, value: 'up' | 'down' | '') => {
    try {
      await chatApi.feedback(id, value)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: value } : m)))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-canvas/65"
        aria-label="Close Ask AI"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-card-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-card-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-2 rotate-45 bg-accent" aria-hidden />
              <h2
                id="ask-ai-title"
                className="text-sm font-semibold tracking-widest text-card-text uppercase"
              >
                Ask the AI
              </h2>
              <Pill tone="neutral" variant="outline" size="sm">
                Read-only · scoped to you
              </Pill>
            </div>
            <p className="mt-1 text-xs text-card-text-muted">
              Hi {firstName} — answers stay grounded in your data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-card-text-faint transition-colors hover:bg-card-hover hover:text-card-text"
            aria-label="Close"
          >
            <FiX className="size-5" />
          </button>
        </div>

        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          aria-busy={busy || !historyLoaded}
        >
          {messages.map((msg) => {
            const links = msg.typing ? [] : evidenceLinks(msg.evidence, msg.toolFamily)
            const period = msg.typing ? null : evidencePeriodLabel(msg.evidence)
            const suggestions = msg.typing || msg.dataStatus !== 'CLARIFY'
              ? []
              : clarifySuggestions(msg.evidence)
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[92%] rounded-xl px-3.5 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-brand text-brand-text'
                      : msg.dataStatus === 'CLARIFY'
                        ? 'border border-warning/30 bg-card-hover text-card-text'
                        : 'bg-card-hover text-card-text',
                  )}
                >
                  {msg.typing ? (
                    <div className="flex items-center gap-1.5 py-1" role="status" aria-label="Thinking">
                      <span className="size-1.5 animate-pulse rounded-full bg-card-text-faint" />
                      <span className="size-1.5 animate-pulse rounded-full bg-card-text-faint [animation-delay:150ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-card-text-faint [animation-delay:300ms]" />
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {period && (
                        <p className="mt-2 text-[11px] text-card-text-faint">Resolved period · {period}</p>
                      )}
                      {suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {suggestions.map((tip) => (
                            <button
                              key={tip}
                              type="button"
                              onClick={() => {
                                setDraft((prev) => {
                                  const base = prev.trim()
                                  if (!base) return tip
                                  if (/\b(yesterday|today|tomorrow|last week|previous week|this week|last month|this month)\b/i.test(base)) {
                                    return base
                                  }
                                  return `${base} (${tip})`
                                })
                                inputRef.current?.focus()
                              }}
                              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                            >
                              <Pill tone="warning" variant="outline" size="sm">
                                Try “{tip}”
                              </Pill>
                            </button>
                          ))}
                        </div>
                      )}
                      {links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {links.map((link) => (
                            <button
                              key={link.key}
                              type="button"
                              onClick={() => openEvidence(link)}
                              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                            >
                              <Pill tone="accent" variant="outline" size="sm">
                                {link.label}
                              </Pill>
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.id !== 'welcome' && !msg.typing && (
                        <div className="mt-3 flex items-center gap-2">
                          {msg.toolFamily && (
                            <span className="text-[11px] text-card-text-faint">{msg.toolFamily}{msg.dataStatus ? ` · ${msg.dataStatus}` : ''}</span>
                          )}
                          <div className="ml-auto flex gap-1">
                            <button
                              type="button"
                              aria-label="Helpful"
                              className={cn('rounded p-1 text-card-text-faint hover:text-card-text', msg.feedback === 'up' && 'text-accent')}
                              onClick={() => void onFeedback(msg.id, msg.feedback === 'up' ? '' : 'up')}
                            >
                              <FiThumbsUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Not helpful"
                              className={cn('rounded p-1 text-card-text-faint hover:text-card-text', msg.feedback === 'down' && 'text-danger')}
                              onClick={() => void onFeedback(msg.id, msg.feedback === 'down' ? '' : 'down')}
                            >
                              <FiThumbsDown className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-card-border px-4 py-4">
          {error && <p className="mb-2 text-xs text-danger-subtle-text">{error}</p>}
          <form onSubmit={(e) => void onSend(e)} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              placeholder="Ask about sales, costs, reviews, invoices..."
              className="h-11 min-w-0 flex-1 rounded-full border border-card-border bg-card-subtle px-4 text-sm text-card-text outline-none placeholder:text-card-text-faint focus:border-accent-border focus:outline-2 focus:outline-offset-0 focus:outline-accent-ring disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
              aria-label="Send"
            >
              <FiArrowRight className="size-5" />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-card-text-faint">
            Grounded in controlled data tools · never invents numbers · no write
            actions from chat
          </p>
        </div>
      </aside>
    </div>
  )
}
