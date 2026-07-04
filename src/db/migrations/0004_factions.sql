CREATE TYPE "public"."faction_status" AS ENUM('active', 'disbanded', 'unknown');

CREATE TABLE "factions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" "faction_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "archived_at" timestamp,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "npcs" ADD COLUMN "faction_id" uuid REFERENCES "factions"("id") ON DELETE SET NULL;
