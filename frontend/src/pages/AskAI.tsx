import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FiArrowRight, FiX } from 'react-icons/fi'
import { useAuth } from '../context/useAuth'
import { Pill } from '../components/ui'
import { cn } from '../lib/cn'

type AskAIProps = {
  open: boolean
  onClose: () => void
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  pills?: string[]
  sources?: string
}

const starterMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    text: 'Good morning, Jimmy. Ask me anything about your locations, sales, costs, reviews, invoices or forecast. I answer only from your data — and I’ll tell you when I don’t have enough of it.',
  },
  {
    id: '2',
    role: 'user',
    text: 'Why were sales down at Woodland Hills yesterday?',
  },
  {
    id: '3',
    role: 'assistant',
    text: 'Woodland Hills net sales were $14,180 vs a $17,420 comparable-Tuesday baseline (−18.6%). The gap is concentrated in delivery 6:30–8:00 PM, where refunds spiked to 9 tickets and two cold-food reviews arrived the same window. Dine-in held roughly flat.',
    pills: ['Net $14,180', '−18.6% vs baseline', '9 refunds'],
    sources:
      'Sources: POS orders (Tue Jul 29) · GBP reviews · refund log · baseline v8',
  },
  {
    id: '4',
    role: 'user',
    text: 'What should I focus on today?',
  },
  {
    id: '5',
    role: 'assistant',
    text: 'Three priorities:\n1. Delivery handoff at Woodland Hills — refund spike and cold-food reviews align.\n2. Sysco chicken breast pricing (+18% / 3 mo) — est. $340/mo overpay.\n3. Approve 2 pending review reply drafts before lunch traffic.',
    sources:
      'Sources: alerts · invoices · review queue · data quality status',
  },
]

function cannedReply(question: string): ChatMessage {
  return {
    id: String(Date.now() + 1),
    role: 'assistant',
    text: `I can only answer from your controlled restaurant data. For “${question.slice(0, 80)}${question.length > 80 ? '…' : ''}”, the strongest next step is to check Overview for the morning brief, Alerts for open exceptions, and Performance → Stores for location detail. I don’t invent numbers when coverage is thin.`,
    sources: 'Sources: dashboard scope · read-only tools · no write actions',
  }
}

export function AskAI({ open, onClose }: AskAIProps) {
  const { user } = useAuth()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [draft, setDraft] = useState('')

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
  }, [messages, open])

  if (!open) return null

  const firstName = (user?.name || 'Jimmy').split(' ')[0]

  const onSend = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text) return

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      text,
    }
    setDraft('')
    setMessages((prev) => [...prev, userMsg])

    window.setTimeout(() => {
      setMessages((prev) => [...prev, cannedReply(text)])
    }, 350)
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
              <span
                className="size-2 rotate-45 bg-accent"
                aria-hidden
              />
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
        >
          {messages.map((msg) => (
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
                    : 'bg-card-hover text-card-text',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.pills && msg.pills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {msg.pills.map((pill) => (
                      <Pill key={pill} tone="accent" variant="outline" size="sm">
                        {pill}
                      </Pill>
                    ))}
                  </div>
                )}
                {msg.sources && (
                  <p className="mt-2 text-[11px] text-card-text-faint">
                    {msg.sources}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-card-border px-4 py-4">
          <form onSubmit={onSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about sales, costs, reviews, invoices..."
              className="h-11 min-w-0 flex-1 rounded-full border border-card-border bg-card-subtle px-4 text-sm text-card-text outline-none placeholder:text-card-text-faint focus:border-accent-border focus:outline-2 focus:outline-offset-0 focus:outline-accent-ring"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
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
