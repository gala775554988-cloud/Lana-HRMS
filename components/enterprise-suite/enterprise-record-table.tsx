import { Button } from "@/components/ui/button";
import { deleteEnterpriseRecord } from "@/lib/enterprise-suite/actions";

export function EnterpriseRecordTable({ rows }: { rows: Array<Record<string, unknown> & { id: string }> }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {['code', 'title', 'status', 'priority', 'data', 'updatedAt', 'actions'].map((header) => <th key={header} className="px-4 py-3 text-start font-medium">{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr> : rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{String(row.code ?? '')}</td>
              <td className="px-4 py-3 font-medium">{String(row.title ?? '')}</td>
              <td className="px-4 py-3">{String(row.status ?? '')}</td>
              <td className="px-4 py-3">{String(row.priority ?? '')}</td>
              <td className="px-4 py-3 max-w-md truncate">{row.data ? JSON.stringify(row.data) : '—'}</td>
              <td className="px-4 py-3">{row.updatedAt instanceof Date ? row.updatedAt.toLocaleString('ar-SA') : String(row.updatedAt ?? '')}</td>
              <td className="px-4 py-3">
                <form action={deleteEnterpriseRecord}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" variant="destructive" size="sm">Delete</Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
