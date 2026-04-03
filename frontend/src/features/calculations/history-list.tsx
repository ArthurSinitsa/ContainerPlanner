import { Link } from "react-router-dom";
import type { CalculationRequestList, StatusEnum } from "../../lib/types";

interface HistoryListProps {
  entries: CalculationRequestList[];
  isLoading: boolean;
  onRefresh: () => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function StatusMarker({ status }: { status: StatusEnum }) {
  if (status === "COMPLETED") {
    return <span className="statusMarker completed">✓</span>;
  }
  if (status === "FAILED") {
    return <span className="statusMarker failed">✕</span>;
  }
  return (
    <span className="statusMarker running">
      <span className="statusMarkerFill" />
    </span>
  );
}

export function CalculationHistoryList({ entries, isLoading, onRefresh }: HistoryListProps) {
  return (
    <div className="stack">
      <div className="row between">
        <h2>История расчетов</h2>
        <button className="button secondary" type="button" onClick={onRefresh}>
          Обновить
        </button>
      </div>
      <div className="history">
        {entries.length === 0 ? (
          <p>Пока нет расчетов.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id}>
              <Link className="historyItem" to={`/calculations/${entry.id}`}>
                <div className="historyRow">
                  <div className="historyMeta">
                    <div className="historyTitleRow">
                      <strong>Заявка #{entry.id}</strong>
                      <span className="historyCreatedAt">{formatDateTime(entry.created_at)}</span>
                    </div>
                    <span>{entry.description || "Без описания"}</span>
                  </div>
                  <StatusMarker status={entry.status} />
                </div>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
