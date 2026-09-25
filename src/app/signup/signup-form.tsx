"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import styles from "@/components/auth/auth.module.css";
import { PLANS } from "@/lib/plans";
import { signupSchema, type SignupField } from "@/lib/validations/auth";
import { signup } from "./actions";

type FieldErrors = Partial<Record<SignupField, string>>;

function firstErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as SignupField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} className={styles.fieldError}>
      {children}
    </span>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const invalid = (field: SignupField) => (errors[field] ? true : undefined);
  const describedBy = (field: SignupField) => (errors[field] ? `su-${field}-error` : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? ""),
      businessName: String(data.get("businessName") ?? ""),
      instagramHandle: String(data.get("instagramHandle") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      plan: data.get("plan"),
      terms: data.get("terms") === "on",
    };

    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }
    setErrors({});

    setPending(true);
    try {
      const result = await signup(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? null);
        return;
      }

      const login = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (!login || login.error) {
        router.push("/login");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {formError && (
        <p role="alert" className={styles.alert}>
          {formError}
        </p>
      )}

      <div className={`${styles.fields} ${styles.fieldsTight}`}>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="su-name" className={styles.label}>
              Full name
            </label>
            <input
              id="su-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Jane Martin"
              className={`${styles.input} ${styles.inputCompact}`}
              aria-invalid={invalid("name")}
              aria-describedby={describedBy("name")}
              required
            />
            <FieldError id="su-name-error">{errors.name}</FieldError>
          </div>
          <div className={styles.field}>
            <label htmlFor="su-businessName" className={styles.label}>
              Business name
            </label>
            <input
              id="su-businessName"
              name="businessName"
              type="text"
              autoComplete="organization"
              placeholder="Café Lumière"
              className={`${styles.input} ${styles.inputCompact}`}
              aria-invalid={invalid("businessName")}
              aria-describedby={describedBy("businessName")}
              required
            />
            <FieldError id="su-businessName-error">{errors.businessName}</FieldError>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="su-instagramHandle" className={styles.label}>
            Instagram account
          </label>
          <div className={styles.prefixed} data-invalid={invalid("instagramHandle")}>
            <span className={styles.prefix} aria-hidden="true">
              @
            </span>
            <input
              id="su-instagramHandle"
              name="instagramHandle"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourbusiness"
              className={styles.prefixedInput}
              aria-invalid={invalid("instagramHandle")}
              aria-describedby={describedBy("instagramHandle")}
              required
            />
          </div>
          <FieldError id="su-instagramHandle-error">{errors.instagramHandle}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="su-email" className={styles.label}>
            Work email
          </label>
          <input
            id="su-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.com"
            className={`${styles.input} ${styles.inputCompact}`}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            required
          />
          <FieldError id="su-email-error">
            {errors.email}
            {errors.email?.includes("Log in") && (
              <>
                {" "}
                <Link href="/login">Go to log in</Link>
              </>
            )}
          </FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="su-password" className={styles.label}>
            Password
          </label>
          <input
            id="su-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="8 characters minimum"
            className={`${styles.input} ${styles.inputCompact}`}
            aria-invalid={invalid("password")}
            aria-describedby={describedBy("password")}
            minLength={8}
            required
          />
          <FieldError id="su-password-error">{errors.password}</FieldError>
        </div>

        <fieldset className={styles.fieldset} aria-describedby={describedBy("plan")}>
          <legend className={styles.legend}>Plan you&apos;re interested in</legend>
          <div className={styles.plans}>
            {PLANS.map((plan) => (
              <label key={plan.id} className={styles.plan}>
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  defaultChecked={plan.id === "growth"}
                  className={styles.planRadio}
                />
                <span className={styles.planName}>{plan.name}</span>
                <span className={styles.planPrice}>{plan.price}</span>
              </label>
            ))}
          </div>
          <FieldError id="su-plan-error">{errors.plan}</FieldError>
        </fieldset>

        <div className={styles.field}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              name="terms"
              aria-invalid={invalid("terms")}
              aria-describedby={describedBy("terms")}
              required
            />
            <span>
              I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          <FieldError id="su-terms-error">{errors.terms}</FieldError>
        </div>
      </div>

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
