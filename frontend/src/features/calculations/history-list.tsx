import { Link } from "react-router-dom";
import { CheckIcon, CrossIcon } from "../../components/icons";
import type { CalculationRequestList, StatusEnum } from "../../lib/types";

interface HistoryListProps {
  entries: CalculationRequestList[];
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function statusLabel(status: StatusEnum): string {
  switch (status) {
    case "COMPLETED":
      return "Завершён";
    case "FAILED":
      return "Ошибка";
    case "PROCESSING":
      return "В работе";
    default:
      return "В очереди";
  }
}

export function StatusMarker({ status }: { status: StatusEnum }) {
  if (status === "COMPLETED") {
    return (
      <span className="statusMarker completed">
        <CheckIcon size={13} />
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="statusMarker failed">
        <CrossIcon size={12} />
      </span>
    );
  }
  return (
    <span className="statusMarker running">
      <span className="statusMarkerFill" />
    </span>
  );
}

export function CalculationHistoryList({ entries }: HistoryListProps) {
  if (entries.length === 0) {
    return <div className="emptyPanel">Пока нет расчётов.</div>;
  }
  return (
    <div className="historyList">
      {entries.map((entry) => (
        <Link key={entry.id} className="historyItem" to={`/calculations/${entry.id}`}>
          <StatusMarker status={entry.status} />
          <span className="historyItemMain">
            <span className="historyItemTitle">{entry.description || `Заявка #${entry.id}`}</span>
            <span className="historyItemMeta">
              #{entry.id} · {statusLabel(entry.status)}
              {entry.source_file ? " · файл" : ""}
            </span>
          </span>
          <span className="historyItemTime">{formatDateTime(entry.created_at)}</span>
        </Link>
      ))}
    </div>
  );
}
