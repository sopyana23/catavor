import { StatusBadge, WorkerActions, WorkerDetails } from '../../../shared/automation/AutomationConsole'
import type { CatalogProps } from '../../../shared/automation/AutomationConsole'

export function AutomationCatalog(props: CatalogProps) {
  return <div>{props.workers.map(worker => <article key={worker.name}>
    <header><strong>{worker.title}</strong><StatusBadge status={worker.status}/></header>
    <WorkerDetails worker={worker}/><WorkerActions worker={worker} controls={props}/>
  </article>)}</div>
}
