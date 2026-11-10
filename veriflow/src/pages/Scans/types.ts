export interface ScanRecord {
  id: number;
  shift_id: string;
  jwt_scanned: Record<string, any>;
  status: 'valid' | 'invalid' | 'warning' | string;
  reason?: string | null;
  scanned_at?: string | null;
  synced_at?: string | null;
}

export interface ScanListResponse {
  items: ScanRecord[];
  limit: number;
  offset: number;
  total: number;
}

export interface RecordScanPayload {
  shift_id: string;
  jwt_scanned: Record<string, any>;
  status: string;
  scanned_at: string;
  reason?: string | null;
}
