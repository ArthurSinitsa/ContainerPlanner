export interface ContainerType {
  id: number;
  name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  max_weight_kg: number;
  volume_m3: number;
}

export interface Product {
  id: number;
  product_id: number;
  name: string | null;
  sku: string | null;
  category?: string | null;
  ean?: number | null;
  battery_flag: boolean;
  updated_at?: string;
}

export interface RequestItem {
  product_id: number;
  quantity: number;
}

export interface CalculationRequestCreate {
  container_type_id: number;
  description?: string;
  items: RequestItem[];
}

export type StatusEnum = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface CalculationRequestList {
  id: number;
  created_at: string;
  status: StatusEnum;
  description?: string;
  source_file: string | null;
}

export interface CalculationRequestDetail {
  id: number;
  created_at: string;
  status: StatusEnum;
  description?: string;
  source_file: string | null;
  items: RequestItem[];
  results: PackingResult[];
}

export interface CalculationStatusResponse {
  id: number;
  status: StatusEnum | string;
  status_display: string;
  task_id: string | null;
  error_message: string | null;
}

export interface FileUploadErrorResponse {
  error: string;
}

export interface FileUploadSuccessResponse {
  message: string;
  request_id: number;
  task_id: string;
  status_url: string;
}

export interface PackingResult {
  id: number;
  container_number: number;
  total_weight_kg: number;
  total_volume_m3: number;
  volume_utilization_percent: number;
  area_utilization_percent: number;
  packing_layout: PackedItemLayout[];
  calculation_request: number;
  container_type: number;
}

export type CalculationDetails = CalculationRequestDetail;

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width: number;
  height: number;
  length: number;
}

export interface PackedItemLayout {
  type: string;
  position: Position;
  dimensions: Dimensions;
  product_id: number;
}

export interface CalculationFileUploadPayload {
  container_type_id: number;
  description?: string;
  file: File;
}

export interface PackedBox {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  label: string;
}

export interface SyncResponse {
  status: "SUCCESS" | "ERROR" | string;
  message: string;
  created: number;
  updated: number;
}
