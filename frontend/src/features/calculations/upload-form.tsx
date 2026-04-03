import { type FormEvent, useState } from "react";
import type { ContainerType } from "../../lib/types";

interface UploadFormProps {
  containers: ContainerType[];
  isSubmitting: boolean;
  onSubmit: (payload: { container_type_id: number; description?: string; file: File }) => Promise<void>;
}

export function UploadCalculationForm({ containers, isSubmitting, onSubmit }: UploadFormProps) {
  const [containerTypeId, setContainerTypeId] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!containerTypeId) {
      setError("Выбери контейнер.");
      return;
    }
    if (!file) {
      setError("Добавь файл .xlsx или .csv.");
      return;
    }
    setError(null);
    await onSubmit({
      container_type_id: containerTypeId,
      description: description.trim() || undefined,
      file
    });
    setDescription("");
    setFile(null);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h2>Новый расчет (загрузка файла)</h2>
      <label className="field">
        <span>Тип контейнера</span>
        <select value={containerTypeId} onChange={(event) => setContainerTypeId(Number(event.target.value))}>
          <option value={0}>Выбери контейнер</option>
          {containers.map((container) => (
            <option key={container.id} value={container.id}>
              {container.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Описание</span>
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

      <div className="field">
        <span>Файл заказа</span>
        <label className="uploadDropzone">
          <div className="uploadDropzoneIcon">+</div>
          <div className="uploadDropzoneTitle">{file ? file.name : "Перетащи файл сюда или выбери вручную"}</div>
          <div className="uploadDropzoneHint">файлы .xlsx/.csv</div>
          <span className="button secondary">Загрузить файлы</span>
          <input
            className="hiddenInput"
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {error ? <p className="errorText">{error}</p> : null}
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Отправка..." : "Рассчитать"}
      </button>
    </form>
  );
}
