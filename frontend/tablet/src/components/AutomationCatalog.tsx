import { useEffect, useState } from 'react'
import { StatusBadge, WorkerActions, WorkerDetails } from '../../../shared/automation/AutomationConsole'
import type { CatalogProps } from '../../../shared/automation/AutomationConsole'

export function AutomationCatalog(props: CatalogProps) {
  const [name, select] = useState('')
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 880px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 880px)')
    const update = () => setWide(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const worker = props.workers.find(w => w.name === name) ?? props.workers[0]
  if (!worker) return null
  const details = <article className="auto-detail"><header><strong>{worker.title}</strong><StatusBadge status={worker.status}/></header>
    <WorkerDetails worker={worker}/><WorkerActions worker={worker} controls={props}/>
  </article>
  return <div className="auto-split"><div className="auto-master">{props.workers.map(w =>
    <div key={w.name}>
      <button aria-pressed={w.name === worker.name} onClick={() => select(w.name)}>{w.title}</button>
      {!wide && w.name === worker.name && details}
    </div>
  )}</div>{wide && details}</div>
}
