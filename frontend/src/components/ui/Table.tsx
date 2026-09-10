import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

export type TableColumn<T> = {
  key: string
  header: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  render?: (row: T, index: number) => ReactNode
}

export type TableProps<T extends Record<string, unknown>> = {
  columns: TableColumn<T>[]
  rows: T[]
  emptyMessage?: string
  className?: string
  getRowKey?: (row: T, index: number) => string
  /**
   * Fixed scroll viewport for the table body (e.g. "26rem").
   * Header stays sticky while rows scroll inside.
   */
  bodyHeight?: string
  footer?: ReactNode
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = 'No data',
  className,
  getRowKey,
  bodyHeight,
  footer,
}: TableProps<T>) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div
        className={cn('max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]', bodyHeight && 'overflow-y-auto')}
        style={bodyHeight ? { height: bodyHeight } : undefined}
      >
        <table className="w-full min-w-[40rem] border-collapse text-sm sm:min-w-[480px]">
          <thead className={cn(bodyHeight && 'sticky top-0 z-10')}>
            <tr className="border-b border-card-border bg-card">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-5 py-3 text-[11px] font-medium tracking-widest text-card-text-faint uppercase',
                    alignClass[col.align ?? 'left'],
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-card-text-muted sm:px-5 sm:py-10"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={getRowKey?.(row, index) ?? String(index)}
                  className="border-b border-card-border last:border-b-0"
                >
                  {columns.map((col) => {
                    const content =
                      col.render?.(row, index) ??
                      (row[col.key] as ReactNode)
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-3 text-card-text sm:px-5 sm:py-3.5',
                          alignClass[col.align ?? 'left'],
                          col.className,
                        )}
                      >
                        {content}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </Card>
  )
}
