import { Alert, Button, Link, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/errors";
import { AuthLayout } from "./AuthLayout";

interface Values {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>();

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(redirect.startsWith("/") ? redirect : "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Log in"
      subtitle="Build forms and review responses."
      footer={<>New here? <Link component={RouterLink} to={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} fontWeight={600}>Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" autoFocus size="medium"
            {...register("email", { required: "Enter your email." })} error={!!errors.email} helperText={errors.email?.message} />
          <TextField label="Password" type="password" autoComplete="current-password" size="medium"
            {...register("password", { required: "Enter your password." })} error={!!errors.password} helperText={errors.password?.message} />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>{isSubmitting ? "Logging in…" : "Log in"}</Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
