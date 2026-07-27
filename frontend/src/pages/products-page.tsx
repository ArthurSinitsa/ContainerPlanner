import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "../components/app-frame";
import { Pagination } from "../components/pagination";
import { Modal } from "../components/modal";
import { PlusIcon, SearchIcon, RefreshIcon, UploadIcon } from "../components/icons";
import { useToast } from "../app/toast-context";
import { extractApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import type { Product } from "../lib/types";

type ProductModalMode = "add" | "edit";

const PAGE_SIZE = 12;
const COLS = "80px 1fr 120px 120px 120px 72px 82px";
// Минимум под все колонки: на узком экране таблица скроллится вбок, а не сжимается
const TABLE_MIN_WIDTH = 760;

type ProductFormState = {
  product_id: string;
  name: string;
  sku: string;
  category: string;
  ean: string;
  battery_flag: boolean;
  is_dangerous: boolean;
  masterbox_length_mm: string;
  masterbox_width_mm: string;
  masterbox_height_mm: string;
  qty_of_masterbox: string;
  masterbox_weight_kg: string;
  pallet_length_mm: string;
  pallet_width_mm: string;
  pallet_height_mm: string;
  qty_of_pallet: string;
  pallet_weight_kg: string;
};

const emptyForm: ProductFormState = {
  product_id: "",
  name: "",
  sku: "",
  category: "",
  ean: "",
  battery_flag: false,
  is_dangerous: false,
  masterbox_length_mm: "",
  masterbox_width_mm: "",
  masterbox_height_mm: "",
  qty_of_masterbox: "1",
  masterbox_weight_kg: "",
  pallet_length_mm: "",
  pallet_width_mm: "",
  pallet_height_mm: "",
  qty_of_pallet: "1",
  pallet_weight_kg: ""
};

function productToForm(p: Product): ProductFormState {
  return {
    product_id: String(p.product_id),
    name: p.name ?? "",
    sku: p.sku ?? "",
    category: p.category ?? "",
    ean: p.ean != null ? String(p.ean) : "",
    battery_flag: p.battery_flag,
    is_dangerous: p.is_dangerous ?? false,
    masterbox_length_mm: p.masterbox_length_mm != null ? String(p.masterbox_length_mm) : "",
    masterbox_width_mm: p.masterbox_width_mm != null ? String(p.masterbox_width_mm) : "",
    masterbox_height_mm: p.masterbox_height_mm != null ? String(p.masterbox_height_mm) : "",
    qty_of_masterbox: p.qty_of_masterbox != null ? String(p.qty_of_masterbox) : "1",
    masterbox_weight_kg: p.masterbox_weight_kg != null ? String(p.masterbox_weight_kg) : "",
    pallet_length_mm: p.pallet_length_mm != null ? String(p.pallet_length_mm) : "",
    pallet_width_mm: p.pallet_width_mm != null ? String(p.pallet_width_mm) : "",
    pallet_height_mm: p.pallet_height_mm != null ? String(p.pallet_height_mm) : "",
    qty_of_pallet: p.qty_of_pallet != null ? String(p.qty_of_pallet) : "1",
    pallet_weight_kg: p.pallet_weight_kg != null ? String(p.pallet_weight_kg) : ""
  };
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function ProductsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.getProducts });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [battery, setBattery] = useState("");
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<ProductModalMode | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const formInitial = useMemo(() => (activeProduct ? productToForm(activeProduct) : emptyForm), [activeProduct]);
  const [form, setForm] = useState<ProductFormState>(formInitial);
  useEffect(() => {
    setForm(formInitial);
  }, [formInitial]);

  const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const products = productsQuery.data ?? [];

  const categoryOptions = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort() as string[],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      if (q) {
        const match =
          String(p.product_id).includes(q) ||
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (category && p.category !== category) return false;
      if (battery === "yes" && !p.battery_flag) return false;
      if (battery === "no" && p.battery_flag) return false;
      return true;
    });
  }, [products, search, category, battery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageProducts = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => {
    setActiveProduct(null);
    setModalMode("add");
  };
  const openEdit = (p: Product) => {
    setActiveProduct(p);
    setModalMode("edit");
  };
  const closeForm = () => {
    setModalMode(null);
    setActiveProduct(null);
  };

  const buildPayload = () => {
    const pid = toInt(form.product_id);
    if (pid == null) throw new Error("product_id должен быть числом.");
    return {
      product_id: pid,
      name: form.name.trim() || null,
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      ean: toInt(form.ean),
      battery_flag: form.battery_flag,
      is_dangerous: form.is_dangerous,
      masterbox_length_mm: toNum(form.masterbox_length_mm),
      masterbox_width_mm: toNum(form.masterbox_width_mm),
      masterbox_height_mm: toNum(form.masterbox_height_mm),
      qty_of_masterbox: toInt(form.qty_of_masterbox) ?? 1,
      masterbox_weight_kg: toNum(form.masterbox_weight_kg),
      pallet_length_mm: toNum(form.pallet_length_mm),
      pallet_width_mm: toNum(form.pallet_width_mm),
      pallet_height_mm: toNum(form.pallet_height_mm),
      qty_of_pallet: toInt(form.qty_of_pallet) ?? 1,
      pallet_weight_kg: toNum(form.pallet_weight_kg)
    };
  };

  const createOrUpdate = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (modalMode === "add") return api.createProduct(payload);
      if (!activeProduct) throw new Error("Нет товара для редактирования.");
      return api.updateProduct(activeProduct.id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({
        type: "success",
        title: modalMode === "add" ? "Добавлено" : "Сохранено",
        message: modalMode === "add" ? "Товар добавлен в базу." : "Товар обновлён."
      });
      closeForm();
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Не удалось сохранить товар.") });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Удалено", message: "Товар удалён." });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Не удалось удалить товар.") });
    }
  });

  const syncGoogleMutation = useMutation({
    mutationFn: api.syncProductsGoogle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База обновлена из Google Sheets." });
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Ошибка синхронизации с Google Sheets.") });
    }
  });

  const syncExcelMutation = useMutation({
    mutationFn: (file: File) => api.syncProductsExcel(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База обновлена из файла." });
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Ошибка загрузки файла.") });
    }
  });

  const isSyncing = syncGoogleMutation.isPending || syncExcelMutation.isPending;

  const changeFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <AppFrame>
      <div className="hero between" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>База товаров</h1>
          <div className="heroSub">
            {products.length} товаров · показано {filtered.length}
          </div>
        </div>
        <button className="btn btn-invert" type="button" onClick={openAdd}>
          <PlusIcon size={16} />
          Добавить товар
        </button>
      </div>

      <div className="toolbar">
        <div className="searchWrap">
          <SearchIcon size={17} />
          <input
            placeholder="Поиск по ID, названию, SKU…"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={isSyncing}
            onClick={() => syncGoogleMutation.mutate()}
          >
            <RefreshIcon size={15} />
            {syncGoogleMutation.isPending ? "Синхронизация…" : "Sync Google Sheets"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={isSyncing}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon size={15} />
            {syncExcelMutation.isPending ? "Загрузка…" : "Загрузить из файла"}
          </button>
          <input
            ref={fileInputRef}
            className="hiddenInput"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) syncExcelMutation.mutate(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="filterRow">
        <span className="monoLabel" style={{ paddingBottom: 9 }}>
          Фильтры
        </span>
        <label className="filterField">
          <span className="monoLabel">Категория</span>
          <select value={category} onChange={(e) => changeFilter(() => setCategory(e.target.value))} style={{ minWidth: 180 }}>
            <option value="">Все категории</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          <span className="monoLabel">Батарея</span>
          <select value={battery} onChange={(e) => changeFilter(() => setBattery(e.target.value))}>
            <option value="">Все товары</option>
            <option value="yes">С батареей</option>
            <option value="no">Без батареи</option>
          </select>
        </label>
      </div>

      <article className="card" data-glow style={{ padding: "12px 12px 8px", animationDelay: "0.12s" }}>
        <div className="tableScroll">
          <div style={{ minWidth: TABLE_MIN_WIDTH }}>
            <div className="gtHead" style={{ gridTemplateColumns: COLS }}>
              <span>ID</span>
              <span>Название</span>
              <span>SKU</span>
              <span>Категория</span>
              <span>EAN</span>
              <span>Battery</span>
              <span />
            </div>

            {productsQuery.isLoading ? (
              <div className="emptyPanel">Загрузка товаров...</div>
            ) : pageProducts.length === 0 ? (
              <div className="emptyPanel">{search || category || battery ? "Ничего не найдено." : "База товаров пуста."}</div>
            ) : (
              pageProducts.map((p) => (
                <div key={p.id} className="gtRow" style={{ gridTemplateColumns: COLS, cursor: "pointer" }} onClick={() => openEdit(p)}>
                  <span className="cellId">{p.product_id}</span>
                  <span className="cellName">{p.name ?? "—"}</span>
                  <span className="cellMono">{p.sku ?? "—"}</span>
                  <span style={{ fontSize: 13, color: "var(--text-mid)" }}>{p.category ?? "—"}</span>
                  <span className="cellMono">{p.ean ?? "—"}</span>
                  <span>
                    {p.battery_flag ? <span className="batPill">● BAT</span> : <span className="dash">—</span>}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <button
                      className="rowDelete"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(p);
                      }}
                    >
                      Удалить
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
      </article>

      <Modal
        open={modalMode === "add" || modalMode === "edit"}
        onClose={() => {
          if (!createOrUpdate.isPending) closeForm();
        }}
        title={modalMode === "add" ? "Новый товар" : "Редактирование товара"}
      >
        <form
          className="modalForm"
          onSubmit={async (e) => {
            e.preventDefault();
            await createOrUpdate.mutateAsync();
          }}
        >
          <div className="modalBody">
            <div className="modalSection">
              <div className="modalSectionLabel">Основные данные</div>
              <div className="formGrid idName">
                <label className="field">
                  <span>product_id *</span>
                  <input type="number" value={form.product_id} onChange={(e) => setField("product_id", e.target.value)} required />
                </label>
                <label className="field">
                  <span>Название</span>
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </label>
              </div>
              <div className="formGrid c3">
                <label className="field">
                  <span>SKU</span>
                  <input value={form.sku} onChange={(e) => setField("sku", e.target.value)} />
                </label>
                <label className="field">
                  <span>Категория</span>
                  <input value={form.category} onChange={(e) => setField("category", e.target.value)} />
                </label>
                <label className="field">
                  <span>EAN</span>
                  <input type="number" value={form.ean} onChange={(e) => setField("ean", e.target.value)} />
                </label>
              </div>
              <div className="row" style={{ gap: 26 }}>
                <label className="checkboxLabel">
                  <input type="checkbox" checked={form.battery_flag} onChange={(e) => setField("battery_flag", e.target.checked)} />
                  Battery
                </label>
                <label className="checkboxLabel">
                  <input type="checkbox" checked={form.is_dangerous} onChange={(e) => setField("is_dangerous", e.target.checked)} />
                  Опасный груз
                </label>
              </div>
            </div>

            <div className="modalSection">
              <div className="modalSectionLabel">Мастербокс</div>
              <div className="formGrid c3">
                <label className="field">
                  <span>Длина (мм)</span>
                  <input type="number" value={form.masterbox_length_mm} onChange={(e) => setField("masterbox_length_mm", e.target.value)} />
                </label>
                <label className="field">
                  <span>Ширина (мм)</span>
                  <input type="number" value={form.masterbox_width_mm} onChange={(e) => setField("masterbox_width_mm", e.target.value)} />
                </label>
                <label className="field">
                  <span>Высота (мм)</span>
                  <input type="number" value={form.masterbox_height_mm} onChange={(e) => setField("masterbox_height_mm", e.target.value)} />
                </label>
              </div>
              <div className="formGrid c2" style={{ marginBottom: 0 }}>
                <label className="field">
                  <span>Шт. в мастербоксе</span>
                  <input type="number" value={form.qty_of_masterbox} onChange={(e) => setField("qty_of_masterbox", e.target.value)} />
                </label>
                <label className="field">
                  <span>Вес мастербокса (кг)</span>
                  <input type="number" step="0.01" value={form.masterbox_weight_kg} onChange={(e) => setField("masterbox_weight_kg", e.target.value)} />
                </label>
              </div>
            </div>

            <div className="modalSection" style={{ marginBottom: 0 }}>
              <div className="modalSectionLabel">Паллет</div>
              <div className="formGrid c3">
                <label className="field">
                  <span>Длина (мм)</span>
                  <input type="number" value={form.pallet_length_mm} onChange={(e) => setField("pallet_length_mm", e.target.value)} />
                </label>
                <label className="field">
                  <span>Ширина (мм)</span>
                  <input type="number" value={form.pallet_width_mm} onChange={(e) => setField("pallet_width_mm", e.target.value)} />
                </label>
                <label className="field">
                  <span>Высота (мм)</span>
                  <input type="number" value={form.pallet_height_mm} onChange={(e) => setField("pallet_height_mm", e.target.value)} />
                </label>
              </div>
              <div className="formGrid c2" style={{ marginBottom: 0 }}>
                <label className="field">
                  <span>Шт. на паллете</span>
                  <input type="number" value={form.qty_of_pallet} onChange={(e) => setField("qty_of_pallet", e.target.value)} />
                </label>
                <label className="field">
                  <span>Вес паллеты (кг)</span>
                  <input type="number" step="0.01" value={form.pallet_weight_kg} onChange={(e) => setField("pallet_weight_kg", e.target.value)} />
                </label>
              </div>
            </div>
          </div>

          <div className="modalFooter">
            <button className="btn btn-ghost" type="button" onClick={closeForm} disabled={createOrUpdate.isPending}>
              Отмена
            </button>
            <button className="btn btn-invert" type="submit" disabled={createOrUpdate.isPending}>
              {createOrUpdate.isPending ? "Сохранение…" : modalMode === "add" ? "Добавить" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(null);
        }}
        title="Удалить товар?"
        widthClassName="modalCardNarrow modalCardDanger"
      >
        {confirmDelete ? (
          <>
            <div className="modalBody">
              <p style={{ margin: 0, color: "var(--text-mid)", fontSize: 14 }}>
                {confirmDelete.name || `ID ${confirmDelete.product_id}`} будет удалён из базы без возможности восстановления.
              </p>
            </div>
            <div className="modalFooter">
              <button className="btn btn-ghost" type="button" disabled={deleteMutation.isPending} onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
              >
                {deleteMutation.isPending ? "Удаляем…" : "Удалить"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </AppFrame>
  );
}
