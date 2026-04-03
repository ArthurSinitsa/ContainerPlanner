import type {
  CalculationFileUploadPayload,
  CalculationRequestCreate,
  CalculationRequestDetail,
  CalculationRequestList,
  CalculationStatusResponse,
  ContainerType,
  FileUploadSuccessResponse,
  Product,
  SyncResponse
} from "./types";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {  // or replace path to url
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      ...init
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error while calling ${url}: ${msg}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getContainers: () => request<ContainerType[]>("/api/containers/"),
  getContainerById: (id: number) => request<ContainerType>(`/api/containers/${id}/`),
  createContainer: (payload: Omit<ContainerType, "id">) =>
    request<ContainerType>("/api/containers/", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateContainer: (id: number, payload: Omit<ContainerType, "id">) =>
    request<ContainerType>(`/api/containers/${id}/`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteContainer: (id: number) =>
    request<void>(`/api/containers/${id}/`, {
      method: "DELETE"
    }),

  getProducts: () => request<Product[]>("/api/products/"),
  syncProductsGoogle: () => {
    // Backend endpoint expects Product serializer; action itself likely ignores body,
    // but we send minimal required/readOnly fields to satisfy validation.
    const payload = {
      id: 0,
      product_id: 0,
      updated_at: new Date().toISOString(),
      battery_flag: false
    };
    return request<SyncResponse>("/api/products/sync-google/", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  syncProductsExcel: async (file: File) => {
    const formData = new FormData();
    formData.set("file", file);

    const url = `${API_BASE_URL}/api/products/sync-excel/`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Network error while calling ${url}: ${msg}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API ${response.status}: ${body || response.statusText}`);
    }

    return (await response.json()) as SyncResponse;
  },

  getCalculations: () => request<CalculationRequestList[]>("/api/calculate/"),
  getCalculationById: (id: number) => request<CalculationRequestDetail>(`/api/calculate/${id}/`),
  getCalculationStatus: (id: number) =>
    request<CalculationStatusResponse>(`/api/calculate/${id}/status/`),
  createManualCalculation: (payload: CalculationRequestCreate) =>
    request<FileUploadSuccessResponse>("/api/calculate/manual/", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  createFileCalculation: async (payload: CalculationFileUploadPayload) => {
    const formData = new FormData();
    formData.set("container_type_id", String(payload.container_type_id));
    if (payload.description) {
      formData.set("description", payload.description);
    }
    formData.set("file", payload.file);

    const response = await fetch(`${API_BASE_URL}/api/calculate/upload_file/`, {
      method: "POST",
      credentials: "include",
      body: formData
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API ${response.status}: ${body || response.statusText}`);
    }
    return await response.json() as Promise<FileUploadSuccessResponse>;
  }
};
