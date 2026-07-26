import { type ClipboardEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Product, RequestItem } from "../../lib/types";
import { PlusIcon, TrashIcon, ClipboardIcon } from "../../components/icons";

interface ManualFormProps {
  containerTypeId: number;
  products: Product[];
  isSubmitting: boolean;
  onSubmit: (payload: { container_type_id: number; items: RequestItem[] }) => Promise<void>;
}

interface Row {
  key: string;
  query: string;
  product_id: number;
  qty: string;
}

let rowSeq = 0;
const makeRow = (query = "", product_id = 0, qty = ""): Row => ({
  key: `r${rowSeq++}`,
  query,
  product_id,
  qty
});

function productLabel(p: Product): string {
  return `${p.product_id} · ${p.name ?? "Без названия"} · ${p.sku ?? "—"}`;
}

/** Комбобокс товара: поиск по product_id/названию/SKU, свободный ввод/вставка ID. */
function ProductCombobox({
  query,
  products,
  onQuery,
  onPick
}: {
  query: string;
  products: Product[];
  onQuery: (value: string) => void;
  onPick: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? products.filter((p) => {
          return (
            String(p.product_id).includes(q) ||
            (p.name ?? "").toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q)
          );
        })
      : products;
    return base.slice(0, 60);
  }, [products, query]);

  return (
    <div className="productSearch" ref={wrapperRef}>
      <input
        value={query}
        placeholder="Начните вводить или вставьте из Excel…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="productSearchDropdown">
          {filtered.length ? (
            filtered.map((p) => (
              <button
                type="button"
                className="productSearchOption"
                key={p.id}
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
              >
                {productLabel(p)}
              </button>
            ))
          ) : (
            <div className="productSearchEmpty">Ничего не найдено</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ManualCalculationForm({ containerTypeId, products, isSubmitting, onSubmit }: ManualFormProps) {
  const [rows, setRows] = useState<Row[]>(() => [makeRow()]);
  const [error, setError] = useState<string | null>(null);

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, makeRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const reset = () => {
    setRows([makeRow()]);
    setError(null);
  };

  const onPasteRows = (e: ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text");
    if (!txt || (!txt.includes("\n") && !txt.includes("\t"))) return;
    e.preventDefault();
    const parsed = txt
      .replace(/\r/g, "")
      .split("\n")
      .map((ln) => ln.split(/\t|;|,/).map((c) => c.trim()))
      .filter((c) => c[0] || c[1])
      .map((c) => makeRow(c[0] ?? "", Number(c[0]) || 0, c[1] ?? ""));
    if (parsed.length) setRows(parsed);
  };

  const resolvePid = (r: Row): number => {
    if (r.product_id > 0) return r.product_id;
    const n = parseInt(r.query, 10);
    return Number.isFinite(n) ? n : 0;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!containerTypeId) {
      setError("Выберите тип контейнера.");
      return;
    }
    const items: RequestItem[] = [];
    for (const r of rows) {
      const pid = resolvePid(r);
      const qty = parseInt(r.qty, 10);
      if (pid <= 0 && !r.qty) continue; // полностью пустая строка — пропускаем
      if (pid <= 0) {
        setError("Укажите корректный ID товара во всех заполненных строках.");
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        setError("Количество должно быть не меньше 1.");
        return;
      }
      items.push({ product_id: pid, quantity: qty });
    }
    if (!items.length) {
      setError("Добавьте хотя бы одну позицию.");
      return;
    }
    setError(null);
    await onSubmit({ container_type_id: containerTypeId, items });
  }

  const many = rows.length > 1;

  return (
    <form onSubmit={submit} style={{ animation: "swapIn .3s ease both" }}>
      <div className="stack compact">
        <div className="manualHead">
          <span>Товар (название / ID)</span>
          <span>Кол-во</span>
          <span />
        </div>

        {rows.map((row) => (
          <div className="manualRow" key={row.key}>
            <ProductCombobox
              query={row.query}
              products={products}
              onQuery={(value) => patchRow(row.key, { query: value, product_id: 0 })}
              onPick={(p) => patchRow(row.key, { query: productLabel(p), product_id: p.product_id })}
            />
            <input
              className="mono"
              value={row.qty}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => patchRow(row.key, { qty: e.target.value })}
              onPaste={onPasteRows}
            />
            <button
              type="button"
              className="rowDeleteBtn"
              title="Удалить позицию"
              disabled={!many}
              onClick={() => removeRow(row.key)}
            >
              <TrashIcon size={15} />
            </button>
          </div>
        ))}

        <div className="between" style={{ marginTop: 4, flexWrap: "wrap", gap: 12 }}>
          <button type="button" className="addRowBtn" onClick={addRow}>
            <PlusIcon size={14} />
            Добавить позицию
          </button>
          <span className="hintRow">
            <ClipboardIcon size={13} />
            можно вставить диапазон из Excel (ID · кол-во)
          </span>
        </div>
      </div>

      {error ? <p className="errorText" style={{ marginTop: 12 }}>{error}</p> : null}

      <div className="composerFooter">
        <button className="btn btn-invert" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Отправка..." : "Рассчитать"}
        </button>
        <button className="btn btn-text" type="button" onClick={reset} disabled={isSubmitting}>
          Сбросить
        </button>
      </div>
    </form>
  );
}
