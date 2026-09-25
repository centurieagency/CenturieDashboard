CREATE TYPE "public"."plan_interest" AS ENUM('essential', 'growth', 'signature');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"business_name" text,
	"instagram_handle" text,
	"plan_interest" "plan_interest",
	"password_hash" text,
	"stripe_customer_id" text,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
