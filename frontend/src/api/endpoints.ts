import { api } from "./client";
import type {
  ActivityLog, Answers, DashboardStats, ExportTask, FieldInput, FormAnalytics, FormDetail, FormResponse,
  FormSettings, FormSummary, HistoryEntry, Page, PublicForm, ResponseFilters, Role, TokenResponse, User,
} from "../types";

type Params = Record<string, unknown>;

const clean = (params: Params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const authApi = {
  login: (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password });
    return api.post<TokenResponse>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then((r) => r.data);
  },
  register: (full_name: string, email: string, password: string) =>
    api.post<User>("/auth/register", { full_name, email, password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  updateMe: (full_name: string) => api.put<User>("/auth/me", { full_name }).then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/me/change-password", { current_password, new_password }).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
};

export const usersApi = {
  list: (params: Params) => api.get<Page<User>>("/users", { params: clean(params) }).then((r) => r.data),
  update: (id: number, data: { full_name?: string; role?: Role; is_active?: boolean }) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
};

export const formsApi = {
  list: (params: Params) => api.get<Page<FormSummary>>("/forms", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<FormDetail>(`/forms/${id}`).then((r) => r.data),
  create: (data: FormSettings & { fields: FieldInput[] }) => api.post<FormDetail>("/forms", data).then((r) => r.data),
  update: (id: number, data: Partial<FormSettings>) => api.put<FormDetail>(`/forms/${id}`, data).then((r) => r.data),
  saveFields: (id: number, fields: FieldInput[]) =>
    api.put<FormDetail>(`/forms/${id}/fields`, { fields }).then((r) => r.data),
  setStatus: (id: number, is_active: boolean) =>
    api.patch<FormSummary>(`/forms/${id}/status`, { is_active }).then((r) => r.data),
  duplicate: (id: number) => api.post<FormDetail>(`/forms/${id}/duplicate`).then((r) => r.data),
  remove: (id: number) => api.delete(`/forms/${id}`).then((r) => r.data),
  activity: (id: number, params: Params) =>
    api.get<Page<ActivityLog>>(`/forms/${id}/activity`, { params: clean(params) }).then((r) => r.data),
};

export const publicApi = {
  get: (slug: string) => api.get<PublicForm>(`/public/forms/${slug}`).then((r) => r.data),
  upload: (slug: string, fieldKey: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api
      .post<{ file_path: string; file_name: string; size_bytes: number }>(`/public/forms/${slug}/upload`, body, {
        params: { field_key: fieldKey },
      })
      .then((r) => r.data);
  },
  submit: (slug: string, answers: Answers) =>
    api.post<{ response_id: number; message: string }>(`/public/forms/${slug}/submit`, { answers }).then((r) => r.data),
};

export const responsesApi = {
  list: (formId: number, params: ResponseFilters & { page: number; size: number }) =>
    api.get<Page<FormResponse>>(`/forms/${formId}/responses`, { params: clean({ ...params }) }).then((r) => r.data),
  mine: (params: Params) => api.get<Page<FormResponse>>("/responses/mine", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<FormResponse>(`/responses/${id}`).then((r) => r.data),
  update: (id: number, answers: Answers) => api.put<FormResponse>(`/responses/${id}`, { answers }).then((r) => r.data),
  remove: (id: number) => api.delete(`/responses/${id}`).then((r) => r.data),
  history: (id: number) => api.get<HistoryEntry[]>(`/responses/${id}/history`).then((r) => r.data),
  fileUrl: (responseId: number, detailId: number) => `/responses/${responseId}/files/${detailId}`,
};

export const analyticsApi = {
  dashboard: (days = 30) => api.get<DashboardStats>("/analytics/dashboard", { params: { days } }).then((r) => r.data),
  form: (id: number, days = 30) => api.get<FormAnalytics>(`/analytics/forms/${id}`, { params: { days } }).then((r) => r.data),
};

export const exportsApi = {
  request: (formId: number, format: "excel" | "pdf", filters: ResponseFilters) =>
    api.post<ExportTask>(`/exports/forms/${formId}`, null, { params: clean({ format, ...filters }) }).then((r) => r.data),
  status: (taskId: string) => api.get<ExportTask>(`/exports/tasks/${taskId}`).then((r) => r.data),
  taskDownloadPath: (taskId: string) => `/exports/tasks/${taskId}/download`,
  syncDownloadPath: (formId: number) => `/exports/forms/${formId}/download`,
};

export const activityApi = {
  list: (params: Params) => api.get<Page<ActivityLog>>("/activity-logs", { params: clean(params) }).then((r) => r.data),
  actions: () => api.get<string[]>("/activity-logs/actions").then((r) => r.data),
};

export { clean };
