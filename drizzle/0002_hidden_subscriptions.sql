CREATE TABLE "hidden_subscriptions" (
	"sub_id" text PRIMARY KEY NOT NULL,
	"hidden_by" text NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL
);
