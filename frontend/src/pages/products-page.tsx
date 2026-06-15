import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/header";
import { Pagination } from "../components/pagination";
import { Modal } from "../components/modal";
import { useToast } from "../app/toast-context";
import { extractApiErrorMessage } from "../lib/api-error";
import { api } from "../lib/api";
import type { Product } from "../lib/types";

type ProductModalMode = "add" | "edit";

const PAGE_SIZE = 25;

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

  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.getProducts });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<ProductModalMode | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [syncUploadMode, setSyncUploadMode] = useState(false);
  const [syncFile, setSyncFile] = useState<File | null>(null);

  const formInitial = useMemo(
    () => (activeProduct ? productToForm(activeProduct) : emptyForm),
    [activeProduct]
  );
  const [form, setForm] = useState<ProductFormState>(formInitial);
  useEffect(() => { setForm(formInitial); }, [formInitial]);

  const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const products = productsQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        String(p.product_id).includes(q) ||
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageProducts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

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
        title: "Готово",
        message: modalMode === "add" ? "Товар добавлен" : "Товар обновлён"
      });
      closeForm();
    },
    onError: (err) => {
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message: extractApiErrorMessage(err, "Не удалось сохранить товар.")
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Удалено", message: "Товар удалён" });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message: extractApiErrorMessage(err, "Не удалось удалить товар.")
      });
    }
  });

  const syncGoogleMutation = useMutation({
    mutationFn: api.syncProductsGoogle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База успешно обновлена из Google Sheets" });
    },
    onError: (err) => {
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message: extractApiErrorMessage(err, "Ошибка синхронизации с Google Sheets")
      });
    }
  });

  const syncExcelMutation = useMutation({
    mutationFn: (file: File) => api.syncProductsExcel(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База успешно обновлена из файла" });
      setSyncUploadMode(false);
      setSyncFile(null);
    },
    onError: (err) => {
      toast.pushToast({
        type: "error",
        title: "Ошибка",
        message: extractApiErrorMessage(err, "Ошибка загрузки файла")
      });
    }
  });

  const isSyncing = syncGoogleMutation.isPending || syncExcelMutation.isPending;

  return (
    <>
      <Header />
      <main className="layout">
        <div className="hero row between">
          <div>
            <h1>База товаров</h1>
            {products.length > 0 && <p>{products.length} товаров в базе</p>}
          </div>
          <button className="button primary" type="button" onClick={openAdd}>
            + Добавить товар
          </button>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ margin: "0 0 12px" }}>
            <div style={{ flex: 1, maxWidth: 340 }}>
              <input
                placeholder="Поиск по ID, названию, SKU, категории..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>
            <div className="row" style={{ margin: 0 }}>
              <button
                className="button secondary"
                type="button"
                disabled={isSyncing}
                onClick={() => { setSyncUploadMode(false); void syncGoogleMutation.mutateAsync(); }}
              >
                {syncGoogleMutation.isPending ? "Синхронизация..." : "Sync Google Sheets"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={isSyncing}
                onClick={() => setSyncUploadMode(true)}
              >
                Загрузить из файла
              </button>
            </div>
          </div>

          {syncUploadMode && (
            <form
              className="stack"
              style={{ marginBottom: 12 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!syncFile) {
                  toast.pushToast({ type: "error", title: "Ошибка", message: "Выбери файл .xlsx/.csv." });
                  return;
                }
                await syncExcelMutation.mutateAsync(syncFile);
              }}
            >
              <label className="uploadDropzone">
                <div className="uploadDropzoneIcon">+</div>
                <div className="uploadDropzoneTitle">
                  {syncFile ? syncFile.name : "Перетащи файл или выбери вручную"}
                </div>
                <div className="uploadDropzoneHint">файлы .xlsx/.csv</div>
                <span className="button secondary" style={{ pointerEvents: "none" }}>Загрузить</span>
                <input
                  className="hiddenInput"
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => setSyncFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => { setSyncUploadMode(false); setSyncFile(null); }}
                  disabled={syncExcelMutation.isPending}
                >
                  Отмена
                </button>
                <button className="button primary" type="submit" disabled={syncExcelMutation.isPending}>
                  {syncExcelMutation.isPending ? "Загружаем..." : "Загрузить"}
                </button>
              </div>
            </form>
          )}

          {productsQuery.isLoading ? (
            <div className="emptyPanel">Загрузка товаров...</div>
          ) : filtered.length === 0 ? (
            <div className="emptyPanel">{search ? "Ничего не найдено." : "База товаров пуста."}</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="tableLike">
                  <thead>
                    <tr>
                      <th>product_id</th>
                      <th>Название</th>
                      <th>SKU</th>
                      <th>Категория</th>
                      <th>EAN</th>
                      <th>Battery</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageProducts.map((p) => (
                      <tr
                        key={p.id}
                        className="tableRowHover"
                        style={{ cursor: "pointer" }}
                        onClick={() => openEdit(p)}
                      >
                        <td>{p.product_id}</td>
                        <td>{p.name ?? "—"}</td>
                        <td>{p.sku ?? "—"}</td>
                        <td>{p.category ?? "—"}</td>
                        <td>{p.ean ?? "—"}</td>
                        <td>{p.battery_flag ? "✓" : "—"}</td>
                        <td>
                          <button
                            className="button danger"
                            type="button"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(p); }}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </div>

        <Modal
          open={modalMode === "add" || modalMode === "edit"}
          onClose={() => { if (!createOrUpdate.isPending) closeForm(); }}
          title={modalMode === "add" ? "Новый товар" : "Редактирование товара"}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await createOrUpdate.mutateAsync();
            }}
          >
            <div style={{ fontWeight: 700, color: "#a09080", fontSize: 12, marginBottom: -4 }}>
              Основные данные
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>product_id *</span>
                <input
                  type="number"
                  value={form.product_id}
                  onChange={(e) => setField("product_id", e.target.value)}
                  required
                />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 2 }}>
                <span>Название</span>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>SKU</span>
                <input value={form.sku} onChange={(e) => setField("sku", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Категория</span>
                <input value={form.category} onChange={(e) => setField("category", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>EAN</span>
                <input type="number" value={form.ean} onChange={(e) => setField("ean", e.target.value)} />
              </label>
            </div>
            <div className="row" style={{ margin: 0, gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={form.battery_flag}
                  onChange={(e) => setField("battery_flag", e.target.checked)}
                />
                <span>Battery</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={form.is_dangerous}
                  onChange={(e) => setField("is_dangerous", e.target.checked)}
                />
                <span>Опасный груз</span>
              </label>
            </div>

            <div style={{ fontWeight: 700, color: "#a09080", fontSize: 12, marginBottom: -4, marginTop: 4 }}>
              Мастербокс
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Длина (мм)</span>
                <input type="number" value={form.masterbox_length_mm} onChange={(e) => setField("masterbox_length_mm", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Ширина (мм)</span>
                <input type="number" value={form.masterbox_width_mm} onChange={(e) => setField("masterbox_width_mm", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Высота (мм)</span>
                <input type="number" value={form.masterbox_height_mm} onChange={(e) => setField("masterbox_height_mm", e.target.value)} />
              </label>
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Шт. в мастербоксе</span>
                <input type="number" value={form.qty_of_masterbox} onChange={(e) => setField("qty_of_masterbox", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Вес мастербокса (кг)</span>
                <input type="number" step="0.01" value={form.masterbox_weight_kg} onChange={(e) => setField("masterbox_weight_kg", e.target.value)} />
              </label>
            </div>

            <div style={{ fontWeight: 700, color: "#a09080", fontSize: 12, marginBottom: -4, marginTop: 4 }}>
              Паллет
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Длина (мм)</span>
                <input type="number" value={form.pallet_length_mm} onChange={(e) => setField("pallet_length_mm", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Ширина (мм)</span>
                <input type="number" value={form.pallet_width_mm} onChange={(e) => setField("pallet_width_mm", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Высота (мм)</span>
                <input type="number" value={form.pallet_height_mm} onChange={(e) => setField("pallet_height_mm", e.target.value)} />
              </label>
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Шт. на паллете</span>
                <input type="number" value={form.qty_of_pallet} onChange={(e) => setField("qty_of_pallet", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                <span>Вес паллеты (кг)</span>
                <input type="number" step="0.01" value={form.pallet_weight_kg} onChange={(e) => setField("pallet_weight_kg", e.target.value)} />
              </label>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
              <button className="button secondary" type="button" onClick={closeForm} disabled={createOrUpdate.isPending}>
                Отмена
              </button>
              <button className="button primary" type="submit" disabled={createOrUpdate.isPending}>
                {createOrUpdate.isPending ? "Сохранение..." : modalMode === "add" ? "Добавить" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!confirmDelete}
          onClose={() => { if (!deleteMutation.isPending) setConfirmDelete(null); }}
          title="Подтверждение удаления"
          widthClassName="modalCardNarrow"
        >
          {confirmDelete && (
            <div className="stack">
              <p style={{ margin: 0, color: "#d6deff" }}>
                Удалить товар <strong>{confirmDelete.name || `ID ${confirmDelete.product_id}`}</strong>?
              </p>
              <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
                <button
                  className="button secondary"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setConfirmDelete(null)}
                >
                  Отмена
                </button>
                <button
                  className="button danger"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={async () => { await deleteMutation.mutateAsync(confirmDelete.id); }}
                >
                  {deleteMutation.isPending ? "Удаляем..." : "Удалить"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </>
  );
}