interface TicketFilterChipsProps {
  value: 'all' | 'assigned_to_me'
  onChange: (value: 'all' | 'assigned_to_me') => void
}

export function TicketFilterChips({ value, onChange }: TicketFilterChipsProps) {
  return (
    <div className="ticket-filter-chips" role="group" aria-label="Assignment filter">
      <button
        type="button"
        className={`ticket-chip${value === 'all' ? ' ticket-chip--active' : ''}`}
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        All tickets
      </button>
      <button
        type="button"
        className={`ticket-chip${value === 'assigned_to_me' ? ' ticket-chip--active' : ''}`}
        aria-pressed={value === 'assigned_to_me'}
        onClick={() => onChange('assigned_to_me')}
      >
        Assigned to me
      </button>
    </div>
  )
}
