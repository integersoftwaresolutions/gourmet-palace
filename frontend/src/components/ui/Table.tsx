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
}: TableProps<T>) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-card-border">
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
                  className="px-5 py-10 text-center text-card-text-muted"
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
                          'px-5 py-3.5 text-card-text',
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
    </Card>
  )
}
