import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

type Section = 'orders' | 'coupons'
type Counts = Record<string, number>
type ResponsePage = {
  data: any[], page: number, limit: number, total: number, facets: Record<string, Counts>, summary: Counts
}
const empty: ResponsePage = { data: [], page: 1, limit: 10, total: 0, facets: {}, summary: {} }
const paths = { orders: '/api/admin/subscription/orders', coupons: '/api/admin/coupons' }
const queryEvent = 'catavor:finance-query'

function subscribe(fn: () => void) {
  window.addEventListener('popstate', fn)
  window.addEventListener(queryEvent, fn)
  return () => { window.removeEventListener('popstate', fn); window.removeEventListener(queryEvent, fn) }
}
const currentSearch = () => window.location.search

export function useFinancePage(section: Section, active: boolean, token?: string | null) {
  const search = useSyncExternalStore(subscribe, currentSearch)
  const params = new URLSearchParams(search)
  const keyword = params.get('q')?.slice(0,150) || ''
  const status = params.get('status') || 'all'
  const kindKey = section === 'orders' ? 'channel' : 'type'
  const kind = params.get(kindKey) || 'all'
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  const limit = [10,25,50,100].find(n => String(n) === params.get('limit')) ?? 10
  const [input,setInput] = useState(keyword)
  const [revision, setRevision] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [result,setResult] = useState<{ key: string, token: string, page?: ResponsePage, error?: string }>()
  const change = useCallback((values: Record<string,string>, replace = false) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab','finance')
    url.searchParams.set('sub',section)
    for (const [key,value] of Object.entries(values)) {
      if (!value || (key !== 'q' && value === 'all') || (key === 'page' && value === '1')) url.searchParams.delete(key)
      else url.searchParams.set(key,value)
    }
    if (url.search === window.location.search) return
    window.history[replace ? 'replaceState' : 'pushState'](window.history.state,'',url)
    window.dispatchEvent(new Event(queryEvent))
  },[section])
  useEffect(() => {
    setInput(keyword)
    const restore = () => {
      clearTimeout(timer.current)
      setInput(new URLSearchParams(window.location.search).get('q')?.slice(0,150) || '')
    }
    window.addEventListener('popstate',restore)
    return () => { clearTimeout(timer.current); window.removeEventListener('popstate',restore) }
  },[keyword,active])
  const setKeyword = (value: string) => {
    const next = value.slice(0,150)
    setInput(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => change({ q: next.trim(), page:'1' },true),300)
  }
  const query = new URLSearchParams({page:String(page),limit:String(limit)})
  if (keyword) query.set('q',keyword)
  if (status !== 'all') query.set('status',status)
  if (kind !== 'all') query.set(kindKey,kind)
  const path = paths[section]+'?'+query
  const key = revision+' '+path
  useEffect(() => {
    if (!active || !token) return
    const controller = new AbortController()
    fetch(path,{signal:controller.signal,headers:{Authorization:'Bearer '+token}})
      .then(async response => {
        if (!response.ok) throw Error('Gagal memuat daftar ('+response.status+')')
        const data: ResponsePage = await response.json()
        if (!Array.isArray(data.data) || !data.facets || !data.summary || !Number.isInteger(data.total)) throw Error('Respons daftar tidak lengkap')
        if (controller.signal.aborted) return
        setResult({ key, token, page: data })
        if (page !== data.page) change({page:String(data.page)},true)
      })
      .catch(error => { if (!controller.signal.aborted) setResult({key,token,error:error.message}) })
    return () => controller.abort()
  },[active,token,path,key,page,change])
  const current = result?.key === key && result.token === token ? result : undefined
  const refresh = useCallback(() => setRevision(n => n+1),[])
  return {
    ...(current?.page || empty), page, limit, status, kind, keyword, input, setKeyword, refresh,
    ready: !!current?.page, loading: active && !current, error: current?.error,
    setStatus: (value: string, replace = false) => change({status:value,page:'1'},replace),
    setKind: (value: string, replace = false) => change({[kindKey]:value,page:'1'},replace),
    go: (n: number) => change({page:String(n)}),
    resize: (n: number) => change({page:'1',limit:String(n)})
  }
}

type Listing = ReturnType<typeof useFinancePage>
export function FinancePager({ list, device }: { list: Listing, device: 'desktop'|'tablet'|'mobile' }) {
  const {page,limit,total} = list
  const pages = Math.max(1,Math.ceil(total/limit))
  if (list.error) return <div role="alert">{list.error} <button type="button" onClick={list.refresh}>Coba lagi</button></div>
  if (list.loading) return <div role="status">Memuat daftar…</div>
  if (pages === 1 && (device !== 'desktop' || limit === 10 || total === 0)) return null
  const first = Math.max(1,Math.min(page-2,pages-4))
  return <nav className="finance-pager" aria-label="Paginasi daftar">
    <span>Menampilkan {(page-1)*limit+1}–{Math.min(total,page*limit)} dari {total}</span>
    {device === 'desktop' && <label>Baris per halaman <select value={limit} onChange={e=>list.resize(Number(e.target.value))}>
      {[10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>}
    <div>{device === 'desktop' && <button disabled={page===1} onClick={()=>list.go(1)}>Awal</button>}
      <button disabled={page===1} onClick={()=>list.go(page-1)}>Sebelumnya</button>
      {device === 'desktop' ? Array.from({length:Math.min(5,pages)},(_,i)=>first+i).map(n=>
        <button key={n} aria-current={n===page?'page':undefined} onClick={()=>list.go(n)}>{n}</button>) : <span>{page}/{pages}</span>}
      <button disabled={page===pages} onClick={()=>list.go(page+1)}>Selanjutnya</button>
      {device === 'desktop' && <button disabled={page===pages} onClick={()=>list.go(pages)}>Akhir</button>}</div>
    {device !== 'mobile' && pages>1 && <form onSubmit={e=>{e.preventDefault();list.go(Number(new FormData(e.currentTarget).get('page')))}}><label>Halaman <input name="page" type="number" min="1" max={pages} required/></label><button>Lompat</button></form>}
  </nav>
}
