import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalculationHistoryList } from "../features/calculations/history-list";
import { ManualCalculationForm } from "../features/calculations/manual-form";
import { UploadCalculationForm } from "../features/calculations/upload-form";
import { api } from "../lib/api";
import type { CalculationRequestCreate, Product } from "../lib/types";
import { Modal } from "../components/modal";
import { useToast } from "../app/toast-context";
import { extractApiErrorMessage } from "../lib/api-error";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [activeForm, setActiveForm] = useState<"upload" | "manual">("upload");

  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [productsUploadMode, setProductsUploadMode] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productsUploadFile, setProductsUploadFile] = useState<File | null>(null);

  const containersQuery = useQuery({ queryKey: ["containers"], queryFn: api.getContainers });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.getProducts });
  const calculationsQuery = useQuery({
    queryKey: ["calculations"],
    queryFn: api.getCalculations,
    refetchInterval: 3000
  });

  const manualMutation = useMutation({
    mutationFn: api.createManualCalculation,
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["calculations"] });
      navigate(`/calculations/${response.request_id}`);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: api.createFileCalculation,
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["calculations"] });
      navigate(`/calculations/${response.request_id}`);
    }
  });

  const syncGoogleMutation = useMutation({
    mutationFn: api.syncProductsGoogle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База успешно обновлена" });
      setProductsUploadMode(false);
      setProductsUploadFile(null);
    },
    onError: (err) => {
      const msg = extractApiErrorMessage(err, "unknown error");
      toast.pushToast({ type: "error", title: "Ошибка", message: `Ошибка обновления базы: ${msg}` });
    }
  });

  const syncExcelMutation = useMutation({
    mutationFn: (file: File) => api.syncProductsExcel(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.pushToast({ type: "success", title: "Готово", message: "База успешно обновлена" });
      setProductsUploadMode(false);
      setProductsUploadFile(null);
    },
    onError: (err) => {
      const msg = extractApiErrorMessage(err, "unknown error");
      toast.pushToast({ type: "error", title: "Ошибка", message: `Ошибка обновления базы: ${msg}` });
    }
  });

  const apiBase = import.meta.env.VITE_API_BASE_URL || "(not set)";

  const mapToBackendProductIds = (payload: CalculationRequestCreate): CalculationRequestCreate => {
    if (!productsQuery.data) return payload;
    const byLocalId = new Map(productsQuery.data.map((p) => [p.id, p.product_id]));
    return {
      ...payload,
      items: payload.items.map((item) => ({
        ...item,
        // UI selects Product.id, backend expects Product.product_id
        product_id: byLocalId.get(item.product_id) ?? item.product_id
      }))
    };
  };

  const errorToText = (err: unknown): string => {
    if (!err) return "";
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const globalError = containersQuery.error || productsQuery.error || calculationsQuery.error || null;

  const loading = containersQuery.isLoading || productsQuery.isLoading || calculationsQuery.isLoading;
  if (loading) {
    return <main className="layout"><div className="card">Загрузка данных...</div></main>;
  }

  if (globalError) {
    return (
      <main className="layout">
        <div className="card">
          Не удалось загрузить данные.
          <div className="error" style={{ marginTop: 12 }}>
            <strong>Ошибка:</strong> {errorToText(globalError)}
          </div>
          <div style={{ marginTop: 10, color: "#b1b7c8" }}>
            Проверь `VITE_API_BASE_URL`: <code>{apiBase}</code>
          </div>
          <div style={{ marginTop: 10, color: "#b1b7c8" }}>
            Частые причины: CORS/credentials, неправильный URL, auth/session cookie не отправляется.
          </div>
        </div>
      </main>
    );
  }

  if (!containersQuery.data || !productsQuery.data || !calculationsQuery.data) {
    return (
      <main className="layout">
        <div className="card">
          Данные не вернулись (data пустая/undefined).
          <div style={{ marginTop: 10, color: "#b1b7c8" }}>
            У контейнеров: {containersQuery.data ? "OK" : "undefined"}; у товаров:{" "}
            {productsQuery.data ? "OK" : "undefined"}; у истории: {calculationsQuery.data ? "OK" : "undefined"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="layout">
      <header className="hero row between">
        <div>
          <h1>Container Planner</h1>
          <p>Demo-ready frontend: ручной/файловый расчёт, история и 3D-визуализация layout.</p>
        </div>
        <div className="row" style={{ margin: 0 }}>
          <button className="button secondary" type="button" onClick={() => navigate("/containers")}>
            Контейнеры
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setProductsModalOpen(true);
              setProductsUploadMode(false);
              setProductsUploadFile(null);
              setShowAllProducts(false);
            }}
          >
            Товары
          </button>
        </div>
      </header>
      {manualMutation.error ? <div className="error">{errorToText(manualMutation.error)}</div> : null}
      {uploadMutation.error ? <div className="error">{errorToText(uploadMutation.error)}</div> : null}

      <section className="grid">
        <article className="card full">
          <div className="formSwitchControls">
            {activeForm === "upload" ? (
              <button className="button secondary" onClick={() => setActiveForm("manual")} type="button">
                Ручной ввод →
              </button>
            ) : (
              <button className="button secondary" onClick={() => setActiveForm("upload")} type="button">
                ← Загрузка файлом
              </button>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {activeForm === "upload" ? (
              <motion.div
                key="uploadForm"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <UploadCalculationForm
                  containers={containersQuery.data}
                  isSubmitting={uploadMutation.isPending}
                  onSubmit={async (payload) => {
                    await uploadMutation.mutateAsync(payload);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="manualForm"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <ManualCalculationForm
                  containers={containersQuery.data}
                  products={productsQuery.data}
                  isSubmitting={manualMutation.isPending}
                  onSubmit={async (payload) => {
                    await manualMutation.mutateAsync(mapToBackendProductIds(payload));
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </article>

        <article className="card full">
          <CalculationHistoryList
            entries={calculationsQuery.data}
            isLoading={calculationsQuery.isFetching}
            onRefresh={() => {
              void calculationsQuery.refetch();
            }}
          />
        </article>
      </section>

      <Modal
        open={productsModalOpen}
        onClose={() => {
          if (!syncGoogleMutation.isPending && !syncExcelMutation.isPending) {
            setProductsModalOpen(false);
            setProductsUploadMode(false);
            setProductsUploadFile(null);
          }
        }}
        title="Управление товарами"
      >
        <div className="stack">
          <div className="row between" style={{ margin: 0 }}>
            <button
              className="button primary"
              type="button"
              disabled={syncGoogleMutation.isPending || syncExcelMutation.isPending}
              onClick={() => {
                setProductsUploadMode(false);
                void syncGoogleMutation.mutateAsync();
              }}
            >
              Синхронизировать с Google sheets
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={syncGoogleMutation.isPending || syncExcelMutation.isPending}
              onClick={() => setProductsUploadMode(true)}
            >
              Обновить из файла
            </button>
          </div>

          {productsUploadMode ? (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!productsUploadFile) {
                  toast.pushToast({ type: "error", title: "Ошибка", message: "Выбери файл .xlsx/.csv." });
                  return;
                }
                await syncExcelMutation.mutateAsync(productsUploadFile);
              }}
            >
              <div className="field" style={{ marginBottom: 0 }}>
                <span>Файл обновления</span>
                <label className="uploadDropzone">
                  <div className="uploadDropzoneIcon">+</div>
                  <div className="uploadDropzoneTitle">
                    {productsUploadFile ? productsUploadFile.name : "Перетащи файл сюда или выбери вручную"}
                  </div>
                  <div className="uploadDropzoneHint">файлы .xlsx/.csv</div>
                  <span className="button secondary" style={{ pointerEvents: "none" }}>
                    Загрузить
                  </span>
                  <input
                    className="hiddenInput"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(event) => setProductsUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setProductsUploadMode(false);
                    setProductsUploadFile(null);
                  }}
                  disabled={syncExcelMutation.isPending}
                >
                  Отмена
                </button>
                <button className="button primary" type="submit" disabled={syncExcelMutation.isPending}>
                  {syncExcelMutation.isPending ? "Обновляем..." : "Загрузить"}
                </button>
              </div>
            </form>
          ) : null}

          <div>
            <div className="row between" style={{ margin: "6px 0 10px" }}>
              <h3 style={{ margin: 0 }}>Список товаров</h3>
              <button
                className="button secondary"
                type="button"
                onClick={() => setShowAllProducts((p) => !p)}
                disabled={productsQuery.isLoading}
              >
                {showAllProducts ? "Показать последние 30" : "Показать все"}
              </button>
            </div>

            <ProductsTable
              products={productsQuery.data ?? []}
              showAll={showAllProducts}
            />
          </div>
        </div>
      </Modal>
    </main>
  );
}

function ProductsTable({ products, showAll }: { products: Product[]; showAll: boolean }) {
  const sorted = useMemo(() => {
    const arr = [...products];
    arr.sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
    return arr;
  }, [products]);

  const visible = showAll ? sorted : sorted.slice(0, 30);

  return (
    <table className="tableLike">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>SKU</th>
          <th>Категория</th>
          <th>EAN</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((p) => (
          <tr key={p.id} className="tableRowHover">
            <td>{p.product_id}</td>
            <td>{p.name ?? "-"}</td>
            <td>{p.sku ?? "-"}</td>
            <td>{p.category ?? "-"}</td>
            <td>{p.ean ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
