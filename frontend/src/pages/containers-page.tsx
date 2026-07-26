import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ContainerType } from "../lib/types";
import { api } from "../lib/api";
import { AppFrame } from "../components/app-frame";
import { Modal } from "../components/modal";
import { PlusIcon, ContainerFrameIcon } from "../components/icons";
import { useToast } from "../app/toast-context";
import { extractApiErrorMessage } from "../lib/api-error";

type ContainerModalMode = "add" | "edit";

type ContainerFormState = {
  name: string;
  length_mm: string;
  width_mm: string;
  height_mm: string;
  max_weight_kg: string;
  volume_m3: string;
};

const emptyForm: ContainerFormState = {
  name: "",
  length_mm: "",
  width_mm: "",
  height_mm: "",
  max_weight_kg: "",
  volume_m3: ""
};

function toNumberOrNaN(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function ContainersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const containersQuery = useQuery({ queryKey: ["containers"], queryFn: api.getContainers });

  const [modalMode, setModalMode] = useState<ContainerModalMode | null>(null);
  const [activeContainer, setActiveContainer] = useState<ContainerType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContainerType | null>(null);

  const formInitial = useMemo<ContainerFormState>(
    () =>
      activeContainer
        ? {
            name: activeContainer.name,
            length_mm: String(activeContainer.length_mm),
            width_mm: String(activeContainer.width_mm),
            height_mm: String(activeContainer.height_mm),
            max_weight_kg: String(activeContainer.max_weight_kg),
            volume_m3: String(activeContainer.volume_m3)
          }
        : emptyForm,
    [activeContainer]
  );

  const [form, setForm] = useState<ContainerFormState>(formInitial);
  useEffect(() => {
    setForm(formInitial);
  }, [formInitial]);

  const containers = containersQuery.data ?? [];
  const volumeMax = useMemo(() => Math.max(1, ...containers.map((c) => c.volume_m3)), [containers]);
  const weightMax = useMemo(() => Math.max(1, ...containers.map((c) => c.max_weight_kg)), [containers]);

  const openAdd = () => {
    setActiveContainer(null);
    setModalMode("add");
  };
  const openEdit = (c: ContainerType) => {
    setActiveContainer(c);
    setModalMode("edit");
  };
  const closeForm = () => {
    setModalMode(null);
    setActiveContainer(null);
  };

  const createOrUpdate = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        length_mm: toNumberOrNaN(form.length_mm),
        width_mm: toNumberOrNaN(form.width_mm),
        height_mm: toNumberOrNaN(form.height_mm),
        max_weight_kg: toNumberOrNaN(form.max_weight_kg),
        volume_m3: toNumberOrNaN(form.volume_m3)
      };
      if (!payload.name) throw new Error("Название контейнера не может быть пустым.");
      if (
        [payload.length_mm, payload.width_mm, payload.height_mm, payload.max_weight_kg, payload.volume_m3].some(
          (n) => !Number.isFinite(n) || n < 0
        )
      ) {
        throw new Error("Числовые поля должны быть корректными (>= 0).");
      }
      if (modalMode === "add") return api.createContainer(payload);
      if (!activeContainer) throw new Error("Нет контейнера для редактирования.");
      return api.updateContainer(activeContainer.id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.pushToast({
        type: "success",
        title: modalMode === "add" ? "Добавлено" : "Сохранено",
        message: modalMode === "add" ? "Контейнер добавлен." : "Контейнер обновлён."
      });
      closeForm();
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Не удалось сохранить контейнер.") });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteContainer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.pushToast({ type: "success", title: "Удалено", message: "Контейнер удалён." });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.pushToast({ type: "error", title: "Ошибка", message: extractApiErrorMessage(err, "Не удалось удалить контейнер.") });
    }
  });

  const setField = <K extends keyof ContainerFormState>(key: K, value: ContainerFormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <AppFrame>
      <div className="hero between" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Контейнеры</h1>
          <div className="heroSub">Управление типами контейнеров · {containers.length} шт.</div>
        </div>
        <button className="btn btn-invert" type="button" onClick={openAdd}>
          <PlusIcon size={16} />
          Добавить контейнер
        </button>
      </div>

      {containersQuery.isLoading ? (
        <div className="card">Загрузка контейнеров...</div>
      ) : containersQuery.isError ? (
        <div className="card">
          Не удалось загрузить контейнеры.
          <div className="error" style={{ marginTop: 12 }}>
            {extractApiErrorMessage(containersQuery.error, "unknown error")}
          </div>
        </div>
      ) : containers.length === 0 ? (
        <div className="card">
          <div className="emptyPanel">Список типов контейнеров пуст.</div>
        </div>
      ) : (
        <section className="tileGrid">
          {containers.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className="tileCard"
              data-glow
              onClick={() => openEdit(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openEdit(c);
              }}
            >
              <button
                className="tileDelete"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(c);
                }}
              >
                Удалить
              </button>

              <div className="tileHead">
                <div>
                  <div className="tileName">{c.name}</div>
                  <div className="tileDims">
                    {c.length_mm} × {c.width_mm} × {c.height_mm} мм
                  </div>
                </div>
                <ContainerFrameIcon style={{ flexShrink: 0, opacity: 0.6 }} />
              </div>

              <div className="tileMetrics">
                <div>
                  <div className="tileMetricLabel">Объём</div>
                  <div className="tileMetricValue">
                    <strong>{c.volume_m3.toFixed(1)}</strong>
                    <span>м³</span>
                  </div>
                  <div className="bar">
                    <div className="barFill accent" style={{ width: `${Math.min(100, (c.volume_m3 / volumeMax) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="tileMetricLabel">Макс. вес</div>
                  <div className="tileMetricValue">
                    <strong>{c.max_weight_kg.toLocaleString("ru-RU")}</strong>
                    <span>кг</span>
                  </div>
                  <div className="bar">
                    <div className="barFill neutral" style={{ width: `${Math.min(100, (c.max_weight_kg / weightMax) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <Modal
        open={modalMode === "add" || modalMode === "edit"}
        onClose={() => {
          if (!createOrUpdate.isPending) closeForm();
        }}
        title={modalMode === "add" ? "Новый контейнер" : "Редактирование контейнера"}
        widthClassName="modalCardNarrow"
      >
        <form
          className="modalForm"
          onSubmit={async (e) => {
            e.preventDefault();
            await createOrUpdate.mutateAsync();
          }}
        >
          <div className="modalBody">
            <label className="field" style={{ marginBottom: 18 }}>
              <span>Название</span>
              <input value={form.name} placeholder="напр. 40ft High Cube" onChange={(e) => setField("name", e.target.value)} />
            </label>
            <div className="formGrid c3">
              <label className="field">
                <span>Длина (мм)</span>
                <input type="number" value={form.length_mm} onChange={(e) => setField("length_mm", e.target.value)} />
              </label>
              <label className="field">
                <span>Ширина (мм)</span>
                <input type="number" value={form.width_mm} onChange={(e) => setField("width_mm", e.target.value)} />
              </label>
              <label className="field">
                <span>Высота (мм)</span>
                <input type="number" value={form.height_mm} onChange={(e) => setField("height_mm", e.target.value)} />
              </label>
            </div>
            <div className="formGrid c2" style={{ marginBottom: 0 }}>
              <label className="field">
                <span>Макс. вес (кг)</span>
                <input type="number" value={form.max_weight_kg} onChange={(e) => setField("max_weight_kg", e.target.value)} />
              </label>
              <label className="field">
                <span>Полезный объём (м³)</span>
                <input type="number" step="0.01" value={form.volume_m3} onChange={(e) => setField("volume_m3", e.target.value)} />
              </label>
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
        title="Удалить контейнер?"
        widthClassName="modalCardNarrow modalCardDanger"
      >
        {confirmDelete ? (
          <>
            <div className="modalBody">
              <p style={{ margin: 0, color: "var(--text-mid)", fontSize: 14 }}>
                {confirmDelete.name} будет удалён из списка типов контейнеров.
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
