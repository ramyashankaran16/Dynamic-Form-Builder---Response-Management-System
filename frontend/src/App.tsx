import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { FullPageLoader, GuestRoute, ProtectedRoute } from "./components/ProtectedRoute";
import "./lib/charts";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const FormsListPage = lazy(() => import("./pages/FormsListPage"));
const FormBuilderPage = lazy(() => import("./pages/FormBuilderPage"));
const ResponsesPage = lazy(() => import("./pages/ResponsesPage"));
const FormAnalyticsPage = lazy(() => import("./pages/FormAnalyticsPage"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));
const MySubmissionsPage = lazy(() => import("./pages/MySubmissionsPage"));
const ActivityLogsPage = lazy(() => import("./pages/ActivityLogsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Public and authenticated respondents */}
        <Route path="/f/:slug" element={<PublicFormPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/forms" element={<FormsListPage />} />
            <Route path="/forms/new" element={<FormBuilderPage />} />
            <Route path="/forms/:id/edit" element={<FormBuilderPage />} />
            <Route path="/forms/:id/responses" element={<ResponsesPage />} />
            <Route path="/forms/:id/analytics" element={<FormAnalyticsPage />} />
            <Route path="/my-submissions" element={<MySubmissionsPage />} />
            <Route path="/activity" element={<ActivityLogsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route path="/forms/:id" element={<Navigate to="edit" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
