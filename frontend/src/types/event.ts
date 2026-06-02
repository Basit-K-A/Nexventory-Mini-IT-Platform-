export interface Event {
  id: number
  event_type: string
  severity: string
  message: string
  timestamp: string
  device_id: number
  resolved_at?: string | null
  resolved_by?: number | null
}

export interface EventCreate {
  event_type: string
  severity: string
  message: string
  device_id: number
}

export interface EventUpdate {
  event_type: string
  severity: string
  message: string
  device_id: number
}
