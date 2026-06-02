export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Network'
  | 'Access Request'
  | 'Asset Request'
  | 'Security'
  | 'Other'

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export type TicketStatus =
  | 'Open'
  | 'In Progress'
  | 'Waiting for User'
  | 'Resolved'
  | 'Closed'

export interface Ticket {
  id: number
  ticket_number: string
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_by: number
  assigned_to: number | null
  created_at: string
  updated_at: string
  resolution_notes?: string | null
  legacy_event_id?: number | null
}

export interface TicketComment {
  id: number
  ticket_id: number
  user_id: number
  body: string
  created_at: string
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[]
}

export interface TicketCreate {
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
}

export interface TicketUpdate {
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  resolution_notes?: string | null
}
