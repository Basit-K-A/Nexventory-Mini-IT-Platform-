import type { PaginatedResponse } from './types'
import { apiRequest, toQueryString } from './client'
import { normalizePaginatedResponse } from './types'
import type { User } from '../types/user'

export async function listUsers(params?: {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  role?: string
  is_active?: boolean
  username?: string
  email?: string
}): Promise<PaginatedResponse<User>> {
  const qs = toQueryString({
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    sort_by: params?.sort_by ?? 'created_at',
    sort_order: params?.sort_order ?? 'desc',
    role: params?.role,
    is_active: params?.is_active,
    username: params?.username,
    email: params?.email,
  })
  const raw = await apiRequest<PaginatedResponse<User>>(`/users${qs}`)
  return normalizePaginatedResponse<User>(raw)
}

export function updateUserRole(userId: number, role: string): Promise<User> {
  return apiRequest<User>(`/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  })
}

