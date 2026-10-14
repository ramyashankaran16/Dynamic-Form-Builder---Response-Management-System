export type Role = "Admin" | "User";

export type FieldType = "text" | "number" | "email" | "date" | "dropdown" | "checkbox" | "radio" | "file" | "rating";

export type Operator =
  | "equals" | "not_equals" | "contains" | "not_contains" | "in" | "not_in"
  | "greater_than" | "less_than" | "greater_or_equal" | "less_or_equal" | "is_empty" | "is_not_empty";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: Role | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Condition {
  field_key: string;
  operator: Operator;
  value?: unknown;
}

export interface VisibilityRules {
  logic: "all" | "any";
  conditions: Condition[];
}

export type FieldConfig = Record<string, unknown>;

export interface FieldOption {
  id?: number;
  label: string;
  value: string;
  order_index?: number;
}

export interface FormField {
  id: number;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
  order_index: number;
  config: FieldConfig | null;
  visibility_rules: VisibilityRules | null;
  options: FieldOption[];
}

export interface FormSettings {
  title: string;
  description: string | null;
  is_public: boolean;
  is_active: boolean;
  allow_response_edit: boolean;
  allow_multiple_submissions: boolean;
  submit_message: string | null;
}

export interface FormSummary extends FormSettings {
  id: number;
  slug: string;
  public_path: string;
  owner_id: number;
  owner_name: string | null;
  field_count: number;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormDetail extends FormSummary {
  fields: FormField[];
}

export interface PublicForm {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  allow_response_edit: boolean;
  fields: FormField[];
}

/** Payload shape for creating / bulk-saving fields */
export interface FieldInput {
  id?: number | null;
  label: string;
  field_key?: string | null;
  field_type: FieldType;
  placeholder?: string | null;
  help_text?: string | null;
  is_required: boolean;
  config: FieldConfig;
  visibility_rules: VisibilityRules | null;
  options: { label: string; value?: string }[];
}

export type Answers = Record<string, unknown>;

export interface ResponseDetailItem {
  id: number;
  field_id: number | null;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  value: unknown;
}

export interface FormResponse {
  id: number;
  form_id: number;
  form_title: string;
  form_slug?: string;
  submitted_by: number | null;
  submitter_name: string | null;
  submitter_email: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
  version: number;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
  answers: Answers;
  details: ResponseDetailItem[];
  can_edit: boolean;
  can_delete: boolean;
}

export interface HistoryEntry {
  id: number;
  action: string;
  description: string | null;
  user_id: number | null;
  user_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface ResponseFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  submitter_type?: "all" | "authenticated" | "anonymous";
  field_key?: string;
  field_value?: string;
  sort_by?: "created_at" | "updated_at" | "id";
  sort_order?: "asc" | "desc";
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface DashboardStats {
  total_forms: number;
  active_forms: number;
  inactive_forms: number;
  public_forms: number;
  total_responses: number;
  responses_today: number;
  responses_last_7_days: number;
  responses_last_30_days: number;
  total_users: number | null;
  active_users: number | null;
  submissions_trend: TrendPoint[];
  top_forms: { form_id: number; title: string; is_active: boolean; response_count: number }[];
  recent_responses: { response_id: number; form_id: number; form_title: string; submitter_name: string | null; created_at: string }[];
}

export interface OptionCount {
  label: string;
  value: string;
  count: number;
  percentage: number;
}

export interface FieldAnalytics {
  field_id: number;
  field_key: string;
  label: string;
  field_type: FieldType;
  answered_count: number;
  response_rate: number;
  option_counts: OptionCount[] | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  earliest: string | null;
  latest: string | null;
}

export interface FormAnalytics {
  form_id: number;
  title: string;
  is_active: boolean;
  total_responses: number;
  authenticated_responses: number;
  anonymous_responses: number;
  edited_responses: number;
  responses_today: number;
  responses_last_7_days: number;
  first_response_at: string | null;
  last_response_at: string | null;
  average_per_day: number;
  submissions_trend: TrendPoint[];
  fields: FieldAnalytics[];
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ExportTask {
  task_id: string;
  status: string;
  format: string | null;
  file_name: string | null;
  download_url: string | null;
  error: string | null;
}
