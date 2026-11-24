export type BroadcastDevice = 'desktop' | 'tablet' | 'mobile';

export type BroadcastStatus = 'draft' | 'scheduled' | 'published' | 'revoked';

export type BroadcastTargetType = 'all' | 'plan' | 'specific' | 'single_store' | 'single_user';

export type BroadcastUrgency = 'info' | 'warning' | 'success' | 'system';

export type BroadcastCategory =
  | 'PENGUMUMAN'
  | 'SISTEM'
  | 'PROMOSI'
  | 'PEMELIHARAAN'
  | 'PANDUAN'
  | 'KEAMANAN';

export type BroadcastActionType = 'none' | 'detail' | 'navigate' | 'external_link';

export interface BroadcastRecipient {
  type: 'store' | 'user';
  id: number;
  name: string;
  slug?: string;
  email?: string;
  plan?: string;
}

export interface SubscriptionPlanOption {
  code: string;
  name: string;
  badge_label?: string;
  description?: string;
  price_monthly?: number;
}

export interface AdminBroadcastRecord {
  id: string;
  target_type: BroadcastTargetType;
  target_plan_code: string;
  target_id: number;
  target_name: string;
  recipients: BroadcastRecipient[];
  is_broadcast: boolean;
  status: BroadcastStatus;
  scheduled_at?: string | null;
  published_at?: string | null;
  revoked_at?: string | null;
  revoked_by?: number;
  target_audience_count: number;
  idempotency_key?: string;
  title: string;
  category: string;
  message: string;
  detail_content: string;
  type: BroadcastUrgency | string;
  action_enabled: boolean;
  action_type: BroadcastActionType | string;
  link_sub_tab: string;
  link_mobile_settings_tab: string;
  action_label: string;
  action_url: string;
  expires_at?: string | null;
  retention_hours?: number;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  read_count: number;
  click_count: number;
  read_rate_pct: number;
  ctr_pct: number;
}

export interface BroadcastMetrics {
  total_broadcasts: number;
  active_broadcasts: number;
  draft_broadcasts: number;
  scheduled_broadcasts: number;
  revoked_broadcasts: number;
  global_broadcasts: number;
  targeted_broadcasts: number;
  total_reads: number;
  total_clicks: number;
  avg_ctr_pct: number;
}

export interface BroadcastPagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_more: boolean;
}

export interface BroadcastListResponse {
  success: boolean;
  data: AdminBroadcastRecord[];
  metrics: BroadcastMetrics;
  pagination: BroadcastPagination;
}

export interface BroadcastFormPayload {
  target_type: BroadcastTargetType;
  target_plan_code: string;
  target_id: number;
  target_name: string;
  recipients: BroadcastRecipient[];
  status: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  idempotency_key?: string;
  title: string;
  category: string;
  message: string;
  detail_content: string;
  type: BroadcastUrgency;
  action_enabled: boolean;
  action_type: BroadcastActionType;
  link_sub_tab: string;
  link_mobile_settings_tab: string;
  action_label: string;
  action_url: string;
  expires_in_hours: number;
}

export interface BroadcastListFilters {
  page?: number;
  limit?: number;
  status?: 'all' | 'active' | 'draft' | 'scheduled' | 'expired' | 'revoked';
  target?: 'all' | 'global' | 'plan' | 'specific' | 'store' | 'user';
  category?: string;
  q?: string;
}

export interface BroadcastModalBackOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
  disabled?: boolean;
}

export interface BroadcastUrlSecurityResult {
  isSafe: boolean;
  isMasterTrusted: boolean;
  domain?: string;
  reason?: string;
}
