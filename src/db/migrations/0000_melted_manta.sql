CREATE TYPE "public"."artifact_status" AS ENUM('extant', 'lost', 'destroyed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."campaign_member_role" AS ENUM('admin', 'gm', 'player', 'observer');--> statement-breakpoint
CREATE TYPE "public"."character_status" AS ENUM('active', 'retired', 'dead');--> statement-breakpoint
CREATE TYPE "public"."expedition_status" AS ENUM('recruiting', 'scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."journal_author_role" AS ENUM('admin', 'gm', 'player', 'observer');--> statement-breakpoint
CREATE TYPE "public"."journal_entity_type" AS ENUM('campaign', 'location', 'npc', 'artifact', 'character', 'expedition', 'session');--> statement-breakpoint
CREATE TYPE "public"."journal_visibility" AS ENUM('public', 'gm_only', 'private');--> statement-breakpoint
CREATE TYPE "public"."location_status" AS ENUM('open', 'active', 'ruined', 'destroyed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."npc_status" AS ENUM('alive', 'dead', 'missing', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'awaiting_notes', 'closed');--> statement-breakpoint
CREATE TYPE "public"."world_change_status" AS ENUM('pending', 'published');--> statement-breakpoint
CREATE TYPE "public"."world_change_type" AS ENUM('location_status_change', 'discovery', 'npc_status_change', 'npc_defeated', 'structure_built', 'structure_destroyed', 'route_opened', 'route_closed', 'faction_event', 'custom');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"actor_id" uuid,
	"action_type" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "artifact_status" DEFAULT 'extant' NOT NULL,
	"location_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "campaign_member_role" DEFAULT 'player' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_members_campaign_id_user_id_unique" UNIQUE("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text,
	CONSTRAINT "campaign_settings_campaign_id_key_unique" UNIQUE("campaign_id","key")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" character_status DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expedition_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expedition_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	CONSTRAINT "expedition_artifacts_expedition_id_artifact_id_unique" UNIQUE("expedition_id","artifact_id")
);
--> statement-breakpoint
CREATE TABLE "expedition_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expedition_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "expedition_locations_expedition_id_location_id_unique" UNIQUE("expedition_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "expedition_npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expedition_id" uuid NOT NULL,
	"npc_id" uuid NOT NULL,
	CONSTRAINT "expedition_npcs_expedition_id_npc_id_unique" UNIQUE("expedition_id","npc_id")
);
--> statement-breakpoint
CREATE TABLE "expedition_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expedition_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expedition_participants_expedition_id_character_id_unique" UNIQUE("expedition_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "expeditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"gm_id" uuid NOT NULL,
	"title" text NOT NULL,
	"premise" text,
	"scheduled_date" timestamp with time zone,
	"status" "expedition_status" DEFAULT 'recruiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_role" "journal_author_role" NOT NULL,
	"entity_type" "journal_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"visibility" "journal_visibility" DEFAULT 'public' NOT NULL,
	"body" text NOT NULL,
	"campaign_day" integer,
	"pinned" boolean DEFAULT false NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"description" text,
	CONSTRAINT "location_connections_from_location_id_to_location_id_unique" UNIQUE("from_location_id","to_location_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "location_status" DEFAULT 'open' NOT NULL,
	"parent_location_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "npc_status" DEFAULT 'alive' NOT NULL,
	"location_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	CONSTRAINT "session_participants_session_id_character_id_unique" UNIQUE("session_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "session_player_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"character_id" uuid,
	"body" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_player_notes_session_id_player_id_unique" UNIQUE("session_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "session_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_reports_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expedition_id" uuid NOT NULL,
	"gm_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_day" integer,
	"played_at" timestamp with time zone,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"discord_id" text,
	"discord_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "world_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_report_id" uuid NOT NULL,
	"change_type" "world_change_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"description" text NOT NULL,
	"metadata" jsonb,
	"status" "world_change_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"session_id" uuid,
	"world_change_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"campaign_day" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_artifacts" ADD CONSTRAINT "expedition_artifacts_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_artifacts" ADD CONSTRAINT "expedition_artifacts_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_locations" ADD CONSTRAINT "expedition_locations_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_locations" ADD CONSTRAINT "expedition_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_npcs" ADD CONSTRAINT "expedition_npcs_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_npcs" ADD CONSTRAINT "expedition_npcs_npc_id_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."npcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_participants" ADD CONSTRAINT "expedition_participants_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_participants" ADD CONSTRAINT "expedition_participants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expeditions" ADD CONSTRAINT "expeditions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expeditions" ADD CONSTRAINT "expeditions_gm_id_users_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_player_notes" ADD CONSTRAINT "session_player_notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_player_notes" ADD CONSTRAINT "session_player_notes_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_player_notes" ADD CONSTRAINT "session_player_notes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_gm_id_users_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_changes" ADD CONSTRAINT "world_changes_session_report_id_session_reports_id_fk" FOREIGN KEY ("session_report_id") REFERENCES "public"."session_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_changes" ADD CONSTRAINT "world_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_world_change_id_world_changes_id_fk" FOREIGN KEY ("world_change_id") REFERENCES "public"."world_changes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;