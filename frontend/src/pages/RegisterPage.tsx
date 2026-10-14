import { Alert, Button, Link, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/errors";
import { AuthLayout } from "./AuthLayout";

interface Values {
  full_name: string;
  email: string;
  password: string;
  confirm: string;
}

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<Values>();

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await registerUser(v.full_name.trim(), v.email.trim(), v.password);
      navigate(redirect.startsWith("/") ? redirect : "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Create an account"
      subtitle="You can build forms and track your submissions."
      footer={<>Already have an account? <Link component={RouterLink} to="/login" fontWeight={600}>Log in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Full name" autoComplete="name" autoFocus size="medium"
            {...register("full_name", { required: "Enter your name.", minLength: { value: 2, message: "Use at least 2 characters." } })}
            error={!!errors.full_name} helperText={errors.full_name?.message} />
          <TextField label="Email" type="email" autoComplete="email" size="medium"
            {...register("email", { required: "Enter your email.", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email." } })}
            error={!!errors.email} helperText={errors.email?.message} />
          <TextField label="Password" type="password" autoComplete="new-password" size="medium"
            {...register("password", { required: "Choose a password.", minLength: { value: 8, message: "Use at least 8 characters." }, maxLength: { value: 72, message: "Use at most 72 characters." } })}
            error={!!errors.password} helperText={errors.password?.message ?? "At least 8 characters."} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" size="medium"
            {...register("confirm", { validate: (v) => v === getValues("password") || "Passwords don't match." })}
            error={!!errors.confirm} helperText={errors.confirm?.message} />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>{isSubmitting ? "Creating account…" : "Create account"}</Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
