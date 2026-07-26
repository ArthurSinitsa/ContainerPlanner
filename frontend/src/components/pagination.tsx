import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function getPageWindow(current: number, total: number): number[] {
  const pages: number[] = [];
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) pages.push(p);
  }
  return pages;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageWindow(page, totalPages);
  return (
    <div className="pagination">
      <button
        className="pageBtn"
        type="button"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        aria-label="Предыдущая страница"
      >
        <ChevronLeftIcon size={15} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`pageBtn${p === page ? " active" : ""}`}
          type="button"
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button
        className="pageBtn"
        type="button"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Следующая страница"
      >
        <ChevronRightIcon size={15} />
      </button>
    </div>
  );
}
