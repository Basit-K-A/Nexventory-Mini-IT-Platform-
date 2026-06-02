/**
 * Ticket service layer — wraps the API client; no duplicate HTTP logic.
 */

import type { TicketListQuery } from '../api/tickets'
import {
  addTicketComment,
  assignTicket,
  assignTicketToMe,
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
  updateTicketStatus,
} from '../api/tickets'
import type { Ticket } from '../types/ticket'
import type { PaginatedResponse } from '../api/types'

export type { TicketListQuery }

export function getTickets(query?: TicketListQuery): Promise<PaginatedResponse<Ticket>> {
  return listTickets(query)
}

/** Fetch tickets for dashboard metrics (API max limit is 100 per page). */
export async function getTicketsForDashboard(
  query: Omit<TicketListQuery, 'page' | 'limit'> = {},
): Promise<Ticket[]> {
  const pageSize = 100
  const all: Ticket[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const response = await listTickets({
      ...query,
      page,
      limit: pageSize,
      sort_by: query.sort_by ?? 'updated_at',
      sort_order: query.sort_order ?? 'desc',
    })
    all.push(...response.data)
    totalPages = response.pagination.total_pages
    page += 1
  }

  return all
}

export { getTicket, createTicket, updateTicket, deleteTicket, addTicketComment }

export function assignTicketToSelf(id: number): Promise<Ticket> {
  return assignTicketToMe(id)
}

export function updateStatus(
  id: number,
  status: string,
  resolution_notes?: string | null,
): Promise<Ticket> {
  return updateTicketStatus(id, status, resolution_notes)
}

export function reassignTicket(id: number, assignedTo: number | null): Promise<Ticket> {
  return assignTicket(id, assignedTo)
}
