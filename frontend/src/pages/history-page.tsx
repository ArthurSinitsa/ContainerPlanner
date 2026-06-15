import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/header";
import { Pagination } from "../components/pagination";
import { StatusMarker, formatDateTime } from "../features/calculations/history-list";
import { api } from "../lib/api";
import type { CalculationRequestList } from "../lib/types";

const PAGE_SIZE = 20;

export function HistoryPage() {
  const [page, setPage] = useState(1);

  const calculationsQuery = useQuery({
    queryKey: ["calculations"],
    queryFn: api.getCalculations,
    refetchInterval: 5000
  });

  const entries: CalculationRequestList[] = calculationsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Header />
      <main className="layout">
        <div className="hero">
          <h1>История расчётов</h1>
          {entries.length > 0 && (
            <p>Всего заявок: {entries.length}</p>
          )}
        </div>

        {calculationsQuery.isLoading ? (
          <div className="card">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "#b0a89a" }}>Пока нет расчётов.</p>
          </div>
        ) : (
          <div className="card">
            <div className="stack" style={{ gap: 8 }}>
              {pageEntries.map((entry) => (
                <Link key={entry.id} className="historyItem" to={`/calculations/${entry.id}`}>
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
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        )}
      </main>
    </>
  );
}