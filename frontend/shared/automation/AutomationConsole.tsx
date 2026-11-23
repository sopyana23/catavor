import { useEffect, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { Activity, Bot, ChevronRight, CircleCheck, Clock3, FlaskConical, History, LayoutDashboard,
  ListChecks, Play, Send, ShieldAlert } from 'lucide-react'
import { automationAPI, formatTime, readLocation, sections, statusText } from './model'
import type { Entry, Section, Snapshot, Worker } from './model'
import './automation.css'

export interface CatalogProps {
  workers: Worker[]
  canManage: boolean
  busy: boolean
  select: (worker: Worker) => void
  history: (worker: Worker) => void
}

export function WorkerActions({ worker, controls }: { worker: Worker, controls: CatalogProps }) {
  return <div className="auto-actions">
    {controls.canManage && worker.manual && <button disabled={controls.busy || worker.is_executing}
      className="auto-primary" onClick={() => controls.select(worker)}><Play/>Jalankan</button>}
    <button onClick={() => controls.history(worker)}>Lihat riwayat</button>
  </div>
}

export function StatusBadge({ status }: { status: string }) {
  return <span className="auto-badge" data-status={status}>{statusText(status)}</span>
}

export function WorkerDetails({ worker }: { worker: Worker }) {
  return <>
    <p>{worker.conditions}</p>
    <p className="auto-meta"><Clock3/>{worker.interval_desc} · {worker.manual ? 'Pemicu manual tersedia' : 'Pemantauan saja'}</p>
    <p className="auto-meta">Observasi terakhir · {formatTime(worker.last_run_at)}</p>
    {worker.last_summary && <p>{worker.last_summary}</p>}
    {worker.last_error && <p className="auto-error">{worker.last_error}</p>}
  </>
}

const navIcons = { overview: LayoutDashboard, bots: ListChecks, logs: History, sandbox: FlaskConical }
const metrics = [
  { key: 'total_workers', label: 'Pekerjaan terdaftar', Icon: Bot },
  { key: 'healthy_workers', label: 'Pekerjaan sehat', Icon: CircleCheck },
  { key: 'executions_24h', label: 'Peristiwa dalam 24 jam', Icon: Activity },
  { key: 'errors_24h', label: 'Gagal dalam 24 jam', Icon: ShieldAlert }
] as const
type PortalTheme = {
  card: string, cardAlt: string, surface: string, border: string, textPrimary: string,
  textSecondary: string, inputBg: string, chipActiveBg?: string
}
type Props = { token?: string | null, canManage: boolean, revision: number, theme: PortalTheme, isDark: boolean,
  device: 'desktop' | 'mobile' | 'tablet', Catalog: ComponentType<CatalogProps> }

export function AutomationConsole({ token, canManage, revision, device, Catalog, theme, isDark }: Props) {
  const [location, setLocation] = useState(readLocation)
  const [refresh, setRefresh] = useState(0)
  const [status, setStatus] = useState<Snapshot | null>(null)
  const [statusError, setStatusError] = useState('')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [logError, setLogError] = useState('')
  const [search, setSearch] = useState(location.search)
  const [selected, setSelected] = useState<Worker | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [age, setAge] = useState(31)
  const [preview, setPreview] = useState('')
  const { section, page, limit, bot } = location
  const pages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    const sync = () => { setLocation(readLocation()); setSelected(null); setMessage('') }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  function navigate(section: Section, options: { page?: number, limit?: number, bot?: string, q?: string } = {}) {
    const url = new URL(window.location.href)
    url.searchParams.set('sub', section)
    for (const key of ['page', 'limit', 'bot', 'q'] as const) {
      const value = options[key]
      if (value) url.searchParams.set(key, String(value))
      else url.searchParams.delete(key)
    }
    if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url)
    setLocation(readLocation())
    setSelected(null)
    setMessage('')
  }
  function logsAt(nextPage: number, size = limit) {
    navigate('logs', { page: nextPage, limit: size, bot, q: location.search })
  }
  useEffect(() => { setSearch(location.search) }, [location.search])
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setStatusError('')
    automationAPI<{ data: Snapshot }>('status', token, { signal: controller.signal })
      .then(({ data }) => { if (!Array.isArray(data?.workers)) throw Error('Katalog tidak tersedia'); setStatus(data) })
      .catch(e => { if (!controller.signal.aborted) { setStatus(null); setStatusError(e.message) } })
    return () => controller.abort()
  }, [token, revision, refresh])
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(limit), bot, q: location.search })
    setEntries(null)
    setLogError('')
    automationAPI<{ data: Entry[], total: number }>('logs?' + params, token, { signal: controller.signal })
      .then(data => { setEntries(data.data); setTotal(data.total) })
      .catch(e => { if (!controller.signal.aborted) setLogError(e.message) })
    return () => controller.abort()
  }, [token, page, limit, bot, location.search, revision, refresh])

  async function run(action: string) {
    if (!canManage || !token || locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await automationAPI<{ message: string }>('trigger', token, { method: 'POST', body: JSON.stringify({ action }) })
      setMessage(result.message)
      setRefresh(n => n + 1)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Permintaan gagal') }
    finally { setSelected(null); setBusy(false); locked.current = false }
  }
  async function simulate() {
    if (!token || locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const data = await automationAPI<{ message: string }>('preview?age_days=' + age, token)
      setPreview(data.message)
    } catch (e) { setPreview(e instanceof Error ? e.message : 'Simulasi gagal') }
    finally { locked.current = false; setBusy(false) }
  }

  const attention = status?.workers.filter(w => ['warning', 'late', 'stopped', 'error'].includes(w.status))
  const colors = {
    colorScheme: isDark ? 'dark' : 'light',
    '--auto-card': theme.card, '--auto-alt': theme.cardAlt, '--auto-surface': theme.surface,
    '--auto-line': theme.border, '--auto-text': theme.textPrimary, '--auto-secondary': theme.textSecondary,
    '--auto-input': theme.inputBg, '--auto-accent': theme.chipActiveBg ?? (isDark ? '#38bdf8' : '#0284c7')
  } as CSSProperties
  return <section className={'automation-console auto-' + device} data-theme={isDark ? 'dark' : 'light'} style={colors} aria-label="Mesin otomasi">
    <nav aria-label="Bagian mesin otomasi">{(Object.keys(sections) as Section[]).map(key => {
      const Icon = navIcons[key]
      return <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon/>{sections[key]}</button>
    })}</nav>
    {statusError && <p role="alert">Status tidak tersedia. {statusError}</p>}
    {section === 'overview' && <>
      <h2>Status pekerjaan</h2>
      {status ? <dl className="auto-metrics">{metrics.map(({ key, label, Icon }) =>
        <div key={key}><dt><span className="auto-icon"><Icon/></span>{label}</dt><dd>{status[key] ?? 'Belum terukur'}</dd></div>
      )}</dl> : !statusError && <p>Memuat status…</p>}
      <div className="auto-overview">
        {attention && <section><h3><ShieldAlert/>Perlu perhatian</h3>
          {attention.length ? <ul className="auto-list">{attention.slice(0, 3).map(w => <li key={w.name}>
            <button className="auto-row" onClick={() => navigate('logs', { bot: w.name })}>
              <span><strong>{w.title}</strong><small>{w.last_error || statusText(w.status)}</small></span><ChevronRight/>
            </button></li>)}</ul> : <p>Belum ada pekerjaan dengan peringatan atau gangguan.</p>}
          {attention.length > 3 && <button onClick={() => navigate('bots')}>Lihat daftar pekerjaan</button>}
        </section>}
        <section><h3><History/>Aktivitas terakhir</h3>
          {logError ? <p role="alert">Riwayat tidak tersedia. {logError}</p> : !entries ? <p>Memuat riwayat…</p> :
            entries.length ? <button className="auto-row" onClick={() => navigate('logs')}>
              <span><strong>{entries[0].bot_title || entries[0].bot_name}</strong><small>{formatTime(entries[0].created_at)}</small></span>
              <StatusBadge status={entries[0].status}/>
            </button> : <p>Belum ada peristiwa tercatat.</p>}
        </section>
      </div>
      {canManage && <section className="auto-delivery"><div><h3><Send/>Uji pengiriman nyata</h3><p>Kirim satu notifikasi panduan ke akun Anda untuk memeriksa pengiriman.</p></div>
        <button disabled={busy} onClick={() => run('test_guide')}>Kirim ke akun saya</button></section>}
    </>}
    {section === 'bots' && <>
      <h2>Daftar pekerjaan</h2>
      {!status && !statusError && <p>Memuat daftar pekerjaan…</p>}
      {status && <Catalog workers={status.workers} busy={busy} canManage={canManage}
        select={worker => { setSelected(worker); setMessage('') }} history={worker => navigate('logs', { bot: worker.name })}/>}
      {status?.workers.length === 0 && <p>Belum ada pekerjaan terdaftar.</p>}
      {selected && <aside className="auto-confirm" aria-label="Konfirmasi eksekusi">
        <strong>{selected.title}</strong><p>{selected.conditions}</p><p>Permintaan ini menggunakan data platform.</p>
        <button disabled={busy} onClick={() => setSelected(null)}>Batal</button>
        <button className="auto-primary" disabled={busy} onClick={() => run(selected.name)}>Konfirmasi eksekusi</button>
      </aside>}
    </>}
    {message && <p role="status">{message}</p>}
    {section === 'logs' && <>
      <h2>Riwayat pekerjaan</h2>
      {bot && <button onClick={() => navigate('logs')}>Hapus filter · {status?.workers.find(w => w.name === bot)?.title ?? bot}</button>}
      <form onSubmit={event => { event.preventDefault(); navigate('logs', { q: search.trim(), bot, limit }) }}>
        <label>Cari riwayat <input type="search" value={search} onChange={event => setSearch(event.target.value)}/></label>
        <button>Cari</button>
      </form>
      {logError ? <p role="alert">Riwayat tidak tersedia. {logError}</p> : entries === null ? <p>Memuat riwayat…</p> :
        entries.length === 0 ? <p>Belum ada peristiwa pada halaman ini.</p> :
        entries.map(entry => <article key={entry.id}><header><strong>{entry.bot_title || entry.bot_name}</strong><StatusBadge status={entry.status}/></header>
          <p>{entry.details}</p>{entry.error_message && <p className="auto-error">{entry.error_message}</p>}
          <p>{formatTime(entry.created_at)} · {entry.trigger_type === 'manual_admin' || entry.trigger_type === 'manual' ? 'Manual admin' : entry.trigger_type} · {entry.triggered_by}</p>
          {entry.target && <p>Target · {entry.target}</p>}</article>)}
      {entries && !logError && <footer>
        <p>Menampilkan {entries.length ? (page - 1) * limit + 1 : 0} – {entries.length ? (page - 1) * limit + entries.length : 0} dari {total} data</p>
        {device === 'desktop' && <label>Baris per halaman <select value={limit} onChange={e => logsAt(1, Number(e.target.value))}>{[10,25,50,100].map(n => <option key={n}>{n}</option>)}</select></label>}
        <div className="auto-actions">{device === 'desktop' && <button disabled={page <= 1} onClick={() => logsAt(1)}>Awal</button>}
          <button disabled={page <= 1} onClick={() => logsAt(page - 1)}>Sebelumnya</button>
          {device === 'desktop' && Array.from({ length: Math.min(pages, 5) }, (_, i) => Math.max(1, Math.min(page - 2, pages - 4)) + i)
            .map(n => <button key={n} aria-label={'Halaman ' + n} aria-current={n === page ? 'page' : undefined} onClick={() => logsAt(n)}>{n}</button>)}
          <span>Hal {page}/{pages}</span><button disabled={page >= pages} onClick={() => logsAt(page + 1)}>Selanjutnya</button>
          {device === 'desktop' && <button disabled={page >= pages} onClick={() => logsAt(pages)}>Akhir</button>}</div>
        {device !== 'mobile' && pages > 1 && <form onSubmit={e => { e.preventDefault(); logsAt(Number(new FormData(e.currentTarget).get('page'))) }}>
          <label>Halaman <input type="number" name="page" min="1" max={pages} required/></label><button>Lompat</button></form>}
      </footer>}
    </>}
    {section === 'sandbox' && <section className="auto-lab"><span className="auto-icon"><FlaskConical/></span><h2>Simulasi retensi tiket</h2>
      <p>Masukkan umur dua tiket contoh, satu tiket tagihan dan satu tiket teknis, untuk melihat mana yang memenuhi syarat retensi. Simulasi hanya membaca data contoh.</p>
      <form onSubmit={e => { e.preventDefault(); simulate() }}>
        <label>Hari sejak penutupan <input type="number" min="0" max="3650" required value={age} onChange={e => { setAge(Number(e.target.value)); setPreview('') }}/></label>
        <button className="auto-primary" disabled={busy}><Play/>Jalankan simulasi</button>
      </form><p role="status">{preview}</p></section>}
  </section>
}
