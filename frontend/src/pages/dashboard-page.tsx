import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "../components/header";
import { CalculationHistoryList } from "../features/calculations/history-list";
import { ManualCalculationForm } from "../features/calculations/manual-form";
import { UploadCalculationForm } from "../features/calculations/upload-form";
import { api } from "../lib/api";
import type { CalculationRequestCreate } from "../lib/types";
import { useState } from "react";

const HISTORY_PREVIEW = 10;

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeForm, setActiveForm] = useState<"upload" | "manual">("upload");

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

  const mapToBackendProductIds = (payload: CalculationRequestCreate): CalculationRequestCreate => {
    if (!productsQuery.data) return payload;
    const byLocalId = new Map(productsQuery.data.map((p) => [p.id, p.product_id]));
    return {
      ...payload,
      items: payload.items.map((item) => ({
        ...item,
        product_id: byLocalId.get(item.product_id) ?? item.product_id
      }))
    };
  };

  const errorToText = (err: unknown): string => {
    if (!err) return "";
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try { return JSON.stringify(err); } catch { return String(err); }
  };

  const globalError = containersQuery.error || productsQuery.error || calculationsQuery.error || null;
  const loading = containersQuery.isLoading || productsQuery.isLoading || calculationsQuery.isLoading;

  if (loading) {
    return (
      <>
        <Header />
        <main className="layout"><div className="card">Загрузка данных...</div></main>
      </>
    );
  }

  if (globalError) {
    return (
      <>
        <Header />
        <main className="layout">
          <div className="card">
            <div className="error">
              Не удалось загрузить данные. Проверьте соединение с сервером и попробуйте обновить страницу.
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!containersQuery.data || !productsQuery.data || !calculationsQuery.data) {
    return (
      <>
        <Header />
        <main className="layout">
          <div className="card">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </div>
        </main>
      </>
    );
  }

  const recentCalculations = calculationsQuery.data.slice(0, HISTORY_PREVIEW);
  const hasMore = calculationsQuery.data.length > HISTORY_PREVIEW;

  return (
    <>
      <Header />
      <main className="layout">
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
                    onSubmit={async (payload) => { await uploadMutation.mutateAsync(payload); }}
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
              entries={recentCalculations}
              isLoading={calculationsQuery.isFetching}
              onRefresh={() => { void calculationsQuery.refetch(); }}
            />
            {hasMore && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <Link to="/history" className="button secondary">
                  Вся история расчётов ({calculationsQuery.data.length}) →
                </Link>
              </div>
            )}
          </article>
        </section>
      </main>
    </>
  );
}