import type { BadgeVariant } from './status'

export function priorityVariant(priority: string): BadgeVariant {
  const p = priority.toLowerCase()
  if (p === 'critical') return 'danger'
  if (p === 'high') return 'warning'
  return 'neutral'
}

export function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'closed' || s === 'resolved') return 'success'
  if (s === 'waiting for user') return 'warning'
  return 'neutral'
}

export const TICKET_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Access Request',
  'Asset Request',
  'Security',
  'Other',
] as const

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

export const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Waiting for User',
  'Resolved',
  'Closed',
] as const

export const TERMINAL_STATUSES = new Set(['Resolved', 'Closed'])
