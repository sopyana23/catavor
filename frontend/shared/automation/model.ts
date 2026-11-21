export interface Worker {
  name: string
  title: string
  category: string
  conditions: string
  manual: boolean
  status: string
  interval_desc: string
  is_executing: boolean
  execution_count: number
  total_processed: number
  last_error?: string
  last_summary?: string
  last_run_at?: string
}

export interface Snapshot {
  workers: Worker[]
  healthy_workers: number
  total_workers: number
  executions_24h: number | null
  errors_24h: number | null
}

export interface Entry {
  id: string
  bot_name: string
  bot_title: string
  trigger_type: string
  triggered_by: string
  details: string
  status: string
  error_message?: string
  created_at: string
  target: string
}

export async function automationAPI<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/admin/automation/' + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Data tidak tersedia (' + response.status + ')')
  }
  return response.json()
}

const statuses: Record<string, string> = {
  running: 'Terpantau', success: 'Berhasil', warning: 'Peringatan', executing: 'Sedang berjalan',
  error: 'Gagal', late: 'Terlambat', idle: 'Siaga', stopped: 'Berhenti', unknown: 'Belum terukur'
}
export function statusText(value: string) {
  return statuses[value] ?? value
}
export function formatTime(value?: string) {
  if (!value || value.startsWith('0001-')) return 'Belum terukur'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export const sections = { overview: 'Ringkasan', bots: 'Daftar Pekerjaan', logs: 'Riwayat', sandbox: 'Sandbox' }
export type Section = keyof typeof sections
export function readLocation() {
  const params = new URLSearchParams(window.location.search)
  const section = params.get('sub') as Section
  return {
    section: Object.hasOwn(sections, section) ? section : 'overview' as Section,
    page: Math.max(1, Math.min(parseInt(params.get('page') ?? '', 10) || 1, 1000000)),
    limit: [10, 25, 50, 100].find(size => String(size) === params.get('limit')) ?? 10,
    bot: params.get('bot') ?? '', search: params.get('q') ?? '',
  }
}
