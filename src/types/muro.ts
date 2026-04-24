// Tipos del muro comunitario de Morón.

export type Localidad =
  | 'moron'
  | 'castelar'
  | 'haedo'
  | 'el-palomar'
  | 'villa-sarmiento';

export interface LocalidadOption {
  id: Localidad;
  label: string;
}

export const LOCALIDADES: LocalidadOption[] = [
  { id: 'moron', label: 'Morón' },
  { id: 'castelar', label: 'Castelar' },
  { id: 'haedo', label: 'Haedo' },
  { id: 'el-palomar', label: 'El Palomar' },
  { id: 'villa-sarmiento', label: 'Villa Sarmiento' },
];

export type MessageStatus = 'ok' | 'reported' | 'removed';

export interface MuroMessage {
  id: string;
  created_at: string;
  localidad: Localidad;
  nickname: string | null;
  body: string;
  status: MessageStatus;
}

export interface PostMessageInput {
  localidad: Localidad;
  nickname?: string;
  body: string;
}

export interface PostMessageSuccess {
  message: MuroMessage;
}

export interface ReportMessageResponse {
  ok: true;
  duplicate?: boolean;
  report_count?: number;
  status?: MessageStatus;
}
