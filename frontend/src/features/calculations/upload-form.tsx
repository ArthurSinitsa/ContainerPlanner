import { type DragEvent, type FormEvent, useState } from "react";
import { useToast } from "../../app/toast-context";
import { api } from "../../lib/api";
import { UploadIcon, FileDownIcon } from "../../components/icons";

interface UploadFormProps {
  containerTypeId: number;
  isSubmitting: boolean;
  onSubmit: (payload: { container_type_id: number; file: File }) => Promise<void>;
}

export function UploadCalculationForm({ containerTypeId, isSubmitting, onSubmit }: UploadFormProps) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f) setError(null);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!containerTypeId) {
      setError("Выберите тип контейнера.");
      return;
    }
    if (!file) {
      setError("Добавьте файл .xlsx или .csv.");
      return;
    }
    setError(null);
    await onSubmit({ container_type_id: containerTypeId, file });
  }

  const reset = () => {
    setFile(null);
    setError(null);
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      await api.downloadRequestTemplate();
    } catch {
      toast.pushToast({
        type: "info",
        title: "Шаблон недоступен",
        message: "Серверная выгрузка шаблона ещё не реализована."
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="dropzoneIcon">
          <UploadIcon size={22} />
        </div>
        <div className="dropzoneTitle">
          {file ? (
            file.name
          ) : (
            <>
              Перетащите <span style={{ color: "var(--accent)" }}>.xlsx</span> или .csv сюда
            </>
          )}
        </div>
        <div className="dropzoneHint">либо нажмите, чтобы выбрать файл</div>
        <input
          className="hiddenInput"
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error ? <p className="errorText" style={{ marginTop: 12 }}>{error}</p> : null}

      <div className="composerFooter">
        <button className="btn btn-invert" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Отправка..." : "Рассчитать"}
        </button>
        <button className="btn btn-text" type="button" onClick={reset} disabled={isSubmitting}>
          Сбросить
        </button>
        <button
          className="btn btn-icon"
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          title="Скачать шаблон .xlsx для заявки"
          style={{ marginLeft: "auto" }}
        >
          <FileDownIcon size={18} />
        </button>
      </div>
    </form>
  );
}
