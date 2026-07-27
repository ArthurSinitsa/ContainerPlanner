import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { AppFrame } from "../components/app-frame";
import { HeroBox } from "../components/hero-box";
import { CalculationHistoryList } from "../features/calculations/history-list";
import { ManualCalculationForm } from "../features/calculations/manual-form";
import { UploadCalculationForm } from "../features/calculations/upload-form";
import { api } from "../lib/api";

const HISTORY_PREVIEW = 5;

function errorToText(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeForm, setActiveForm] = useState<"upload" | "manual">("upload");
  const [containerTypeId, setContainerTypeId] = useState(0);
  const [description, setDescription] = useState("");

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

  const globalError = containersQuery.error || productsQuery.error || calculationsQuery.error || null;
  const loading = containersQuery.isLoading || productsQuery.isLoading || calculationsQuery.isLoading;

  if (loading) {
    return (
      <AppFrame>
        <div className="card">Загрузка данных...</div>
      </AppFrame>
    );
  }

  if (globalError || !containersQuery.data || !productsQuery.data || !calculationsQuery.data) {
    return (
      <AppFrame>
        <div className="card">
          <div className="error">
            Не удалось загрузить данные. Проверьте соединение с сервером и попробуйте обновить страницу.
          </div>
        </div>
      </AppFrame>
    );
  }

  const containers = containersQuery.data;
  const products = productsQuery.data;
  const calculations = calculationsQuery.data;
  const recent = calculations.slice(0, HISTORY_PREVIEW);
  // Пустое описание не отправляем — бэк подставит своё («Из файла …») либо оставит пустым
  const trimmedDescription = description.trim() || undefined;

  return (
    <AppFrame>
      <section className="hero">
        <div className="between heroHeadRow" style={{ alignItems: "flex-end", gap: 40, paddingBottom: 20 }}>
          <div style={{ maxWidth: 640 }}>
            <div className="heroEyebrow">РАСЧЁТ УПАКОВКИ</div>
            <p className="heroLead">
              Загрузите заявку файлом или соберите её вручную — алгоритм разложит груз по контейнерам с учётом
              веса, габаритов и бизнес-правил.
            </p>
            <div className="heroStats">
              <div>
                <div className="heroStatValue">{containers.length}</div>
                <div className="heroStatLabel">ТИПОВ КОНТЕЙНЕРОВ</div>
              </div>
              <div className="heroStatDivider" />
              <div>
                <div className="heroStatValue">{products.length}</div>
                <div className="heroStatLabel">ТОВАРОВ В БАЗЕ</div>
              </div>
              <div className="heroStatDivider" />
              <div>
                <div className="heroStatValue">{calculations.length}</div>
                <div className="heroStatLabel">РАСЧЁТОВ</div>
              </div>
            </div>
          </div>
          <HeroBox />
        </div>
      </section>

      {manualMutation.error ? <div className="error">{errorToText(manualMutation.error)}</div> : null}
      {uploadMutation.error ? <div className="error">{errorToText(uploadMutation.error)}</div> : null}

      <section className="grid composer">
        <article className="card" data-glow style={{ animationDelay: "0.1s" }}>
          <div className="tabRow">
            <button
              type="button"
              className={`tab${activeForm === "upload" ? " active" : ""}`}
              onClick={() => setActiveForm("upload")}
            >
              Загрузка файлом
            </button>
            <button
              type="button"
              className={`tab${activeForm === "manual" ? " active" : ""}`}
              onClick={() => setActiveForm("manual")}
            >
              Ручной ввод
            </button>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <span className="monoLabel">Тип контейнера</span>
            <select value={containerTypeId} onChange={(e) => setContainerTypeId(Number(e.target.value))}>
              <option value={0}>Выберите контейнер</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <span className="monoLabel">Описание</span>
            <input
              value={description}
              placeholder="напр. Экспорт RU→KZ, паллеты"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {activeForm === "upload" ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <UploadCalculationForm
                  containerTypeId={containerTypeId}
                  isSubmitting={uploadMutation.isPending}
                  onSubmit={async (payload) => {
                    await uploadMutation.mutateAsync({ ...payload, description: trimmedDescription });
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ManualCalculationForm
                  containerTypeId={containerTypeId}
                  products={products}
                  isSubmitting={manualMutation.isPending}
                  onSubmit={async (payload) => {
                    await manualMutation.mutateAsync({ ...payload, description: trimmedDescription });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </article>

        <article className="card" data-glow style={{ padding: 24, animationDelay: "0.2s" }}>
          <div className="cardHeader">
            <span className="cardTitle">История расчётов</span>
            <span className="monoLabel">Последние {HISTORY_PREVIEW}</span>
          </div>
          <CalculationHistoryList entries={recent} />
          <Link to="/history" className="historyMore">
            Вся история ({calculations.length})
          </Link>
        </article>
      </section>
    </AppFrame>
  );
}
