import type { SelectHTMLAttributes } from 'react'

interface TicketSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function TicketSelect({ label, className = '', id, children, ...props }: TicketSelectProps) {
  const selectId = id ?? (label ? `ticket-select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <label className={`ticket-field ${className}`.trim()}>
      {label ? <span className="ticket-field__label">{label}</span> : null}
      <div className="ticket-select-wrap">
        <select id={selectId} className="ticket-select" {...props}>
          {children}
        </select>
      </div>
    </label>
  )
}
