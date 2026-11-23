import { StatusBadge, WorkerActions, WorkerDetails } from '../../../shared/automation/AutomationConsole'
import type { CatalogProps } from '../../../shared/automation/AutomationConsole'

export function AutomationCatalog(props: CatalogProps) {
  return <div className="auto-table-wrap"><table><caption>Jadwal, ketentuan, dan hasil terakhir</caption>
    <thead><tr><th>Pekerjaan</th><th>Ketentuan dan hasil</th><th>Status</th><th>Tindakan</th></tr></thead>
    <tbody>{props.workers.map(worker => <tr key={worker.name}>
      <th scope="row">{worker.title}</th><td><WorkerDetails worker={worker}/></td>
      <td><StatusBadge status={worker.status}/></td><td><WorkerActions worker={worker} controls={props}/></td>
    </tr>)}</tbody></table></div>
}
