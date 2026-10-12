CREATE TYPE "public"."direction" AS ENUM('INFLOW', 'OUTFLOW');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('PENDING', 'SETTLED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recurrence_id" uuid,
	"direction" "direction" NOT NULL,
	"description" varchar(120) NOT NULL,
	"status" "occurrence_status" NOT NULL,
	"amount" integer,
	"period" date NOT NULL,
	"due_date" date,
	"settled_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrences_amount_positive" CHECK ("occurrences"."amount" IS NULL OR "occurrences"."amount" > 0),
	CONSTRAINT "occurrences_settled_has_amount" CHECK ("occurrences"."status" <> 'SETTLED' OR "occurrences"."amount" IS NOT NULL),
	CONSTRAINT "occurrences_settled_at_iff_settled" CHECK (("occurrences"."status" = 'SETTLED') = ("occurrences"."settled_at" IS NOT NULL)),
	CONSTRAINT "occurrences_due_date_within_period" CHECK ("occurrences"."due_date" IS NULL OR date_trunc('month', "occurrences"."due_date")::date = "occurrences"."period"),
	CONSTRAINT "occurrences_period_first_of_month" CHECK (extract(day FROM "occurrences"."period") = 1)
);
--> statement-breakpoint
CREATE TABLE "recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"direction" "direction" NOT NULL,
	"description" varchar(120) NOT NULL,
	"default_amount" integer,
	"due_day" smallint,
	"start_period" date NOT NULL,
	"end_period" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurrences_default_amount_positive" CHECK ("recurrences"."default_amount" IS NULL OR "recurrences"."default_amount" > 0),
	CONSTRAINT "recurrences_due_day_in_month" CHECK ("recurrences"."due_day" IS NULL OR "recurrences"."due_day" BETWEEN 1 AND 31),
	CONSTRAINT "recurrences_start_period_first_of_month" CHECK (extract(day FROM "recurrences"."start_period") = 1),
	CONSTRAINT "recurrences_end_period_first_of_month" CHECK ("recurrences"."end_period" IS NULL OR extract(day FROM "recurrences"."end_period") = 1),
	CONSTRAINT "recurrences_end_period_not_before_start" CHECK ("recurrences"."end_period" IS NULL OR "recurrences"."end_period" >= "recurrences"."start_period")
);
--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_user_id_recurrence_id_period_idx" ON "occurrences" USING btree ("user_id","recurrence_id","period") WHERE "occurrences"."recurrence_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "occurrences_user_id_period_idx" ON "occurrences" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "recurrences_user_id_idx" ON "recurrences" USING btree ("user_id");