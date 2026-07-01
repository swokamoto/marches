ALTER TABLE "artifacts" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "archived_at" timestamp;