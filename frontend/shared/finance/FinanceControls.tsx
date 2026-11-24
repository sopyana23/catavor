import { useEffect, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { CreditCard, Settings2, Ticket } from 'lucide-react'
import './finance.css'

const tabs = { orders: ['Transaksi', CreditCard], settings: ['Pengaturan', Settings2], coupons: ['Kupon', Ticket] } as const
type Section = keyof typeof tabs

export function useFinanceSection(active: boolean, settings: boolean, coupons: boolean, orders = true) {
  function read(): Section {
    const sub = new URLSearchParams(window.location.search).get('sub')
    if (sub === 'orders' && orders) return 'orders'
    if (sub === 'settings' && settings) return sub
    if (sub === 'coupons' && coupons) return sub
    if (orders) return 'orders'
    if (settings) return 'settings'
    if (coupons) return 'coupons'
    return 'orders'
  }
  const [section, setSection] = useState<Section>(read)
  useEffect(() => {
    if (!active) return
    const sync = () => setSection(read())
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [active, settings, coupons, orders])
  function select(next: Section) {
    if (section === next) return
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'finance')
    url.searchParams.set('sub', next)
    for (const key of ['q','status','channel','type','page','limit']) url.searchParams.delete(key)
    window.history.pushState(window.history.state, '', url)
    window.dispatchEvent(new Event('catavor:finance-query'))
    setSection(next)
  }
  return [section, select] as const
}

export function FinanceNav({ section, select, settings, coupons, pending, orders = true }: {
  section: Section, select: (section: Section) => void, settings: boolean, coupons: boolean, pending: number, orders?: boolean
}) {
  return <nav className="finance-nav" aria-label="Bagian pembayaran">{(Object.keys(tabs) as Section[]).map(key => {
    if ((key === 'orders' && !orders) || (key === 'settings' && !settings) || (key === 'coupons' && !coupons)) return null
    const [label, Icon] = tabs[key]
    return <button key={key} type="button" onClick={() => select(key)} aria-current={section === key ? 'page' : undefined}>
      <Icon aria-hidden="true"/>{label}{key === 'orders' && pending > 0 && <span aria-label={pending + ' transaksi tertunda'}>{pending}</span>}
    </button>
  })}</nav>
}

const paymentModes = [
  ['gateway_aulaa', 'Gateway Aulaa', 'Pembayaran otomatis melalui gateway.'],
  ['manual_qris', 'QRIS dan transfer', 'QRIS memakai nominal pas. Transfer bank memakai kode unik.'],
  ['maintenance', 'Pemeliharaan', 'Tutup sementara checkout paket berbayar.']
] as const

export function PaymentModePicker({ value, select }: { value: string, select: (value: string) => void }) {
  return <fieldset className="finance-modes">
    <legend>Metode checkout</legend>
    <p>Pilih mode untuk dikonfigurasi. Perubahan berlaku setelah Anda menyimpan pengaturan.</p>
    <div>{paymentModes.map(([id, label, description]) =>
      <label key={id} className={value === id ? 'selected' : ''}>
        <input type="radio" name="payment-checkout-mode" value={id} checked={value === id} onChange={() => select(id)}/>
        <span><strong>{label}</strong><small>{description}</small></span>
      </label>)}</div>
  </fieldset>
}

export function financeColors(isDark: boolean, theme: {
  card: string, cardAlt: string, border: string, textPrimary: string, textSecondary: string
}) {
  return {
    '--fin-surface': theme.card, '--fin-alt': theme.cardAlt, '--fin-line': theme.border,
    '--fin-ink': theme.textPrimary, '--fin-muted': theme.textSecondary,
    '--fin-accent': isDark ? '#6ee7b7' : '#06654e', '--fin-action-text': isDark ? '#0b211a' : '#ffffff'
  } as CSSProperties
}

type Option = { value: string, label: string, count: number }
type ChangeFilter = (value: string, replace?: boolean) => void
type PickerProps = { value: string, options: Option[], onChange: (value: string) => void, ariaLabel: string,
  title?: string, searchable?: boolean, interceptBack?: boolean, triggerStyle?: CSSProperties, style?: CSSProperties }

export function CountedFilter({ Picker, value, onChange, title, options, ready = true }: {
  Picker: ComponentType<PickerProps>, value: string, onChange: ChangeFilter, title: string, options: Option[], ready?: boolean
}) {
  const visible = options.filter(opt => opt.value === 'all' || opt.count > 0)
  const valid = visible.some(opt => opt.value === value)
  useEffect(() => { if (ready && !valid) onChange('all', true) }, [onChange, valid, ready])
  function applySelection(next: string) {
    // The native picker removes its temporary history entry when the sheet closes.
    // Commit the filter to the underlying page after that navigation has finished.
    if (/^modal_(mobile|tablet)_select_/.test(window.history.state?.modalKey ?? '')) {
      window.addEventListener('popstate', () => onChange(next), { once: true })
    } else {
      onChange(next)
    }
  }
  return <div className="finance-filter">
    <span>{title}</span>
    <Picker ariaLabel={title} title={title} options={visible} value={valid ? value : 'all'} searchable={false}
      interceptBack onChange={applySelection} style={{ minWidth: 0, width: '100%' }}
      triggerStyle={{ minHeight: 44, maxWidth: '100%', backgroundColor: 'var(--fin-surface)', color: 'var(--fin-ink)', borderColor: 'var(--fin-line)' }}/>
  </div>
}

const channels = { gateway_aulaa: 'Gateway Aulaa', manual_qris: 'QRIS manual', manual_bank: 'Transfer bank', coupon_free: 'Kupon gratis' }
type FinanceFilterProps = {
  Picker: ComponentType<PickerProps>, facets: Record<string, Record<string, number>>, ready: boolean,
  status: string, kind: string, onStatus: ChangeFilter, onKind: ChangeFilter
}
function countedOptions(labels: Record<string, string>, counts: Record<string, number> = {}) {
  return Object.entries(labels).map(([value, label]) => ({ value, label, count: counts[value] ?? 0 }))
}
export function CouponFilters({ Picker, facets, ready, status, kind, onStatus, onKind }: FinanceFilterProps) {
  return <div className="finance-filters">
    <CountedFilter Picker={Picker} title="Jenis kupon" value={kind} onChange={onKind} ready={ready}
      options={countedOptions({ all: 'Semua jenis', free: 'Gratis', discount: 'Potongan harga' }, facets.type)}/>
    <CountedFilter Picker={Picker} title="Status kupon" value={status} onChange={onStatus} ready={ready}
      options={countedOptions({ all: 'Semua status', active: 'Aktif', inactive: 'Nonaktif' }, facets.status)}/>
  </div>
}
export function OrderFilters({ Picker, facets, ready, status, channel, onStatus, onChannel }: {
  Picker: ComponentType<PickerProps>, facets: Record<string, Record<string, number>>, ready: boolean,
  status: string, channel: string, onStatus: ChangeFilter, onChannel: ChangeFilter
}) {
  const statuses = { all: 'Semua status', pending: 'Menunggu', paid: 'Lunas', rejected: 'Ditolak atau batal' }
  return <div className="finance-filters">
    <CountedFilter Picker={Picker} title="Status transaksi" value={status} onChange={onStatus} ready={ready} options={countedOptions(statuses,facets.status)}/>
    <CountedFilter Picker={Picker} title="Metode pembayaran" value={channel} onChange={onChannel} ready={ready} options={countedOptions({all:'Semua metode',...channels},facets.channel)}/>
  </div>
}
