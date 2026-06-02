import { useState, type FormEvent } from 'react'
import type { TicketCreate } from '../../types/ticket'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../utils/ticketStatus'
import { TicketSelect } from './TicketSelect'

const emptyForm: TicketCreate = {
  title: '',
  description: '',
  category: 'Other',
  priority: 'Medium',
}

interface CreateTicketModalProps {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (data: TicketCreate) => Promise<void>
}

export function CreateTicketModal({ open, submitting, onClose, onSubmit }: CreateTicketModalProps) {
  const [form, setForm] = useState<TicketCreate>(emptyForm)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await onSubmit(form)
      setForm(emptyForm)
    } catch {
      // Parent surfaces error; keep form values for retry.
    }
  }

  function handleClose() {
    setForm(emptyForm)
    onClose()
  }

  return (
    <div className="modal-backdrop tickets-ui" role="presentation" onClick={handleClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="create-ticket-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2 id="create-ticket-title">Create ticket</h2>
          <button type="button" className="ticket-btn ticket-btn--ghost" onClick={handleClose}>
            Close
          </button>
        </header>

        <form className="ticket-form-grid" onSubmit={handleSubmit}>
          <label className="ticket-field ticket-field--full">
            <span className="ticket-field__label">Title</span>
            <input
              className="ticket-input"
              required
              maxLength={255}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="ticket-field ticket-field--full">
            <span className="ticket-field__label">Description</span>
            <textarea
              className="ticket-textarea"
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <TicketSelect
            label="Category"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as TicketCreate['category'] })
            }
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </TicketSelect>
          <TicketSelect
            label="Priority"
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as TicketCreate['priority'] })
            }
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </TicketSelect>
          <div className="ticket-form-actions">
            <button type="button" className="ticket-btn ticket-btn--ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="ticket-btn ticket-btn--primary" disabled={submitting}>
              Submit ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
