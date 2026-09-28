import styles from "./chart.module.css";
import { formatDay, formatNumber, type Point } from "./chart-utils";

/** Vue tableau d'une série : toutes les valeurs restent accessibles sans survol. */
export function DataTable({ data, valueLabel }: { data: Point[]; valueLabel: string }) {
  return (
    <details className={styles.tableView}>
      <summary>View as table</summary>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((p) => (
              <tr key={p.date}>
                <td>{formatDay(p.date, true)}</td>
                <td>{formatNumber(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
