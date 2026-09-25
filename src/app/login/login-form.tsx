"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { credentialsSchema } from "@/lib/validations/auth";
import styles from "@/components/auth/auth.module.css";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "That email and password don't match. Check them and try again.",
  OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
  AccessDenied: "Access denied.",
};

function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? "We couldn't log you in. Please try again.";
}

type LoginFormProps = {
  callbackUrl: string;
  initialError?: string;
};

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(authErrorMessage(initialError));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      const issues = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setFieldErrors({
        email: issues.has("email") ? "Enter a valid email address." : undefined,
        password: issues.has("password") ? "Your password has at least 8 characters." : undefined,
      });
      return;
    }
    setFieldErrors({});

    setPending(true);
    const result = await signIn("credentials", { ...parsed.data, redirect: false });
    setPending(false);

    if (!result || result.error) {
      setFormError(authErrorMessage(result?.error ?? "Default"));
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {formError && (
        <p role="alert" className={styles.alert}>
          {formError}
        </p>
      )}

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="login-email" className={styles.label}>
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.com"
            className={styles.input}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            required
          />
          {fieldErrors.email && (
            <span id="login-email-error" className={styles.fieldError}>
              {fieldErrors.email}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="login-password" className={styles.label}>
              Password
            </label>
            <Link href="/forgot-password" className={styles.forgot}>
              Forgot password?
            </Link>
          </div>
          <div className={styles.passwordWrap}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className={`${styles.input} ${styles.passwordInput}`}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              required
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-controls="login-password"
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {fieldErrors.password && (
            <span id="login-password-error" className={styles.fieldError}>
              {fieldErrors.password}
            </span>
          )}
        </div>
      </div>

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <button
        type="button"
        className={styles.googleButton}
        onClick={() => void signIn("google", { callbackUrl })}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}
