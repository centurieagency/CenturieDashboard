CREATE TABLE "sales_payment_links" (
	"user_id" uuid NOT NULL,
	"plan" "plan_interest" NOT NULL,
	"stripe_link_id" text NOT NULL,
	"url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_payment_links_user_id_plan_pk" PRIMARY KEY("user_id","plan")
);
--> statement-breakpoint
ALTER TABLE "sales_payment_links" ADD CONSTRAINT "sales_payment_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;