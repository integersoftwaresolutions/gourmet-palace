import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../ui'

type AuthLayoutProps = {
  children: ReactNode
  eyebrow?: string
  badge?: string | null
  infoTitle?: string
  infoBody?: string
}

export function AuthLayout({
  children,
  eyebrow = 'Sign in with your invited work account.',
  badge = 'Invitation required',
  infoTitle = 'Access is limited to active, allowlisted users.',
  infoBody = 'Need access? Contact your administrator.',
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-[15%] size-[420px] rounded-full bg-brand/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-5%] bottom-[-10%] size-[380px] rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] left-[-10%] size-[280px] rounded-full bg-canvas-hover/80 blur-3xl"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-2xl border border-card-border bg-card px-6 py-8 shadow-xl md:px-8 md:py-9">
          <div className="mb-7 flex flex-col items-center text-center">
            <Link to="/signin" className="mb-4 inline-flex">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-text">
                GP
              </span>
            </Link>
            <h1 className="text-[1.35rem] font-bold tracking-[0.12em] text-card-text uppercase">
              Gourmet Palace
            </h1>
            <p className="font-display mt-0.5 text-[1.65rem] leading-none text-accent-subtle-text italic">
              Command Center
            </p>
            <p className="mt-4 text-sm text-card-text-muted">{eyebrow}</p>
            {badge ? (
              <Pill tone="accent" variant="outline" className="mt-4">
                {badge}
              </Pill>
            ) : null}
          </div>

          {children}

          <div className="mt-6 rounded-xl border border-card-border bg-card-subtle px-4 py-3.5">
            <p className="text-sm font-medium text-card-text">{infoTitle}</p>
            <p className="mt-1 text-xs text-card-text-faint">{infoBody}</p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-canvas-text-faint">
          Protected session · deactivated accounts are rejected on the next
          request
        </p>
      </div>
    </div>
  )
}
