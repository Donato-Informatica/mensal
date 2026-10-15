ALTER TABLE "users" ADD COLUMN "show_summary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "confirm_status_changes" boolean DEFAULT true NOT NULL;