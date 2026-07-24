import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  action?: ReactNode
}

export function PageShell({ title, children, action }: Props) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6">
      {(title || action) && (
        <header className="mb-6 flex items-end justify-between gap-4">
          {title ? (
            <h1 className="font-display text-4xl text-amber-hot sm:text-5xl">{title}</h1>
          ) : (
            <div />
          )}
          {action}
        </header>
      )}
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="max-w-md text-lg text-muted">{message}</p>
    </div>
  )
}

export function LoadingState() {
  return <EmptyState message="Loading…" />
}
