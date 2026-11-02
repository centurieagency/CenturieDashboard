CREATE TABLE "onboarding_briefs" (
	"sub_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"answers" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_briefs" ADD CONSTRAINT "onboarding_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;