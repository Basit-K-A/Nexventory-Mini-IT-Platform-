import type { Ticket, TicketComment, TicketCreate, TicketDetail, TicketUpdate } from '../types/ticket'
import { apiRequest, toQueryString } from './client'
import type { PaginatedResponse } from './types'
import { normalizePaginatedResponse } from './types'

export interface TicketListQuery {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  status?: string
  priority?: string
  category?: string
  search?: string
  mine_only?: boolean
  assigned_to_me?: boolean
  unassigned?: boolean
  open_only?: boolean
}

export async function listTickets(
  query: TicketListQuery = {},
): Promise<PaginatedResponse<Ticket>> {
  const qs = toQueryString({
    page: query.page,
    limit: query.limit,
    sort_by: query.sort_by,
    sort_order: query.sort_order,
    status: query.status,
    priority: query.priority,
    category: query.category,
    search: query.search,
    mine_only: query.mine_only,
    assigned_to_me: query.assigned_to_me,
    unassigned: query.unassigned,
    open_only: query.open_only,
  })
  const raw = await apiRequest<PaginatedResponse<Ticket>>(`/tickets${qs}`)
  return normalizePaginatedResponse<Ticket>(raw)
}

export function getTicket(id: number): Promise<TicketDetail> {
  return apiRequest<TicketDetail>(`/tickets/${id}`)
}

export function createTicket(data: TicketCreate): Promise<Ticket> {
  return apiRequest<Ticket>('/tickets', { method: 'POST', body: data })
}

export function updateTicket(id: number, data: TicketUpdate): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}`, { method: 'PUT', body: data })
}

export function updateTicketStatus(
  id: number,
  status: string,
  resolution_notes?: string | null,
): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: { status, resolution_notes: resolution_notes ?? null },
  })
}

export function assignTicketToMe(id: number): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/assign/me`, { method: 'POST' })
}

export function assignTicket(id: number, assigned_to: number | null): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/assign`, {
    method: 'PATCH',
    body: { assigned_to },
  })
}

export function deleteTicket(id: number): Promise<void> {
  return apiRequest<void>(`/tickets/${id}`, { method: 'DELETE' })
}

export function addTicketComment(id: number, body: string): Promise<TicketComment> {
  return apiRequest<TicketComment>(`/tickets/${id}/comments`, {
    method: 'POST',
    body: { body },
  })
}
