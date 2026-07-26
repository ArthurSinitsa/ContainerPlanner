import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppFrame } from "../components/app-frame";
import { Pagination } from "../components/pagination";
import { StatusMarker } from "../features/calculations/history-list";
import { ChevronRightIcon, SearchIcon } from "../components/icons";
import { api } from "../lib/api";
import type { CalculationRequestList } from "../lib/types";

const PAGE_SIZE = 10;
const COLS = "36px minmax(0,1fr) 220px 150px 24px";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: "", date: iso, time: "" };
  return {
    key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

function sourceLabel(entry: CalculationRequestList) {
  if (!entry.source_file) return "Ручной ввод";
  const name = entry.source_file.split(/[\\/]/).pop();
  return name || "Файл";
}

export function HistoryPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const calculationsQuery = useQuery({
    queryKey: ["calculations"],
    queryFn: api.getCalculations,
    refetchInterval: 5000
  });

  const entries = calculationsQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries.filter((c) => {
      const { key } = parts(c.created_at);
      if (q) {
        const title = (c.description ?? `Заявка #${c.id}`).toLowerCase();
        const src = sourceLabel(c).toLowerCase();
        if (!title.includes(q) && !src.includes(q) && !String(c.id).includes(q)) return false;
      }
      if (from && key < from) return false;
      if (to && key > to) return false;
      if (status && c.status !== status) return false;
      return true;
    });
  }, [entries, search, from, to, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const resetFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setStatus("");
    setPage(1);
  };

  return (
    <AppFrame>
      <div className="hero">
        <h1>История расчётов</h1>
        <div className="heroSub">
          {entries.length} заявок · найдено {filtered.length}
        </div>
      </div>

      <div className="filterRow">
        <div className="searchWrap">
          <SearchIcon size={17} />
          <input
            placeholder="Поиск по названию или источнику…"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
        </div>
        <label className="filterField">
          <span className="monoLabel">С даты</span>
          <input type="date" value={from} onChange={(e) => changeFilter(() => setFrom(e.target.value))} />
        </label>
        <label className="filterField">
          <span className="monoLabel">По дату</span>
          <input type="date" value={to} onChange={(e) => changeFilter(() => setTo(e.target.value))} />
        </label>
        <label className="filterField">
          <span className="monoLabel">Статус</span>
          <select value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value))}>
            <option value="">Все статусы</option>
            <option value="COMPLETED">Завершён</option>
            <option value="PROCESSING">В работе</option>
            <option value="FAILED">Ошибка</option>
          </select>
        </label>
        <button className="btn btn-ghost btn-sm" type="button" onClick={resetFilters}>
          Сбросить
        </button>
      </div>

      <article className="card" data-glow style={{ padding: "12px 12px 8px", animationDelay: "0.12s" }}>
        <div className="gtHead" style={{ gridTemplateColumns: COLS, gap: 14 }}>
          <span />
          <span>Заявка</span>
          <span>Источник</span>
          <span>Дата</span>
          <span />
        </div>

        {calculationsQuery.isLoading ? (
          <div className="emptyPanel">Загрузка...</div>
        ) : pageEntries.length === 0 ? (
          <div className="emptyPanel">
            {entries.length === 0 ? "Пока нет расчётов." : "По заданным фильтрам ничего не найдено."}
          </div>
        ) : (
          pageEntries.map((entry) => {
            const t = parts(entry.created_at);
            return (
              <Link key={entry.id} to={`/calculations/${entry.id}`} className="gtRow" style={{ gridTemplateColumns: COLS, gap: 14 }}>
                <span style={{ display: "flex" }}>
                  <StatusMarker status={entry.status} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="cellName">{entry.description || `Заявка #${entry.id}`}</span>
                  <span className="cellSub">#{entry.id}</span>
                </span>
                <span className="cellMono">{sourceLabel(entry)}</span>
                <span>
                  <span className="cellDate">{t.date}</span>
                  <br />
                  <span className="cellTime">{t.time}</span>
                </span>
                <span className="rowChevron">
                  <ChevronRightIcon size={16} />
                </span>
              </Link>
            );
          })
        )}

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
      </article>
    </AppFrame>
  );
}
