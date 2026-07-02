import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  jsonb,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Timestamps helper ────────────────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ─── Enums ────────────────────────────────────────────────────────────────────

export const campaignMemberRoleEnum = pgEnum("campaign_member_role", [
  "admin",
  "gm",
  "player",
  "observer",
]);

export const characterStatusEnum = pgEnum("character_status", [
  "active",
  "retired",
  "dead",
]);

export const locationStatusEnum = pgEnum("location_status", [
  "open",
  "active",
  "ruined",
  "destroyed",
  "unknown",
]);

export const npcStatusEnum = pgEnum("npc_status", [
  "alive",
  "dead",
  "missing",
  "unknown",
]);

export const artifactStatusEnum = pgEnum("artifact_status", [
  "extant",
  "lost",
  "destroyed",
  "unknown",
]);

export const expeditionStatusEnum = pgEnum("expedition_status", [
  "recruiting",
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "awaiting_notes",
  "closed",
]);

export const reportStatusEnum = pgEnum("report_status", ["draft", "published"]);

export const worldChangeTypeEnum = pgEnum("world_change_type", [
  "location_status_change",
  "discovery",
  "npc_status_change",
  "npc_defeated",
  "structure_built",
  "structure_destroyed",
  "route_opened",
  "route_closed",
  "faction_event",
  "custom",
]);

export const worldChangeStatusEnum = pgEnum("world_change_status", [
  "pending",
  "published",
]);

export const journalVisibilityEnum = pgEnum("journal_visibility", [
  "public",
  "gm_only",
  "private",
]);

export const journalAuthorRoleEnum = pgEnum("journal_author_role", [
  "admin",
  "gm",
  "player",
  "observer",
]);

export const journalEntityTypeEnum = pgEnum("journal_entity_type", [
  "campaign",
  "location",
  "npc",
  "artifact",
  "character",
  "expedition",
  "session",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null if using OAuth only
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  discordId: text("discord_id").unique(),
  discordUsername: text("discord_username"),
  ...timestamps,
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const campaignMembers = pgTable(
  "campaign_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: campaignMemberRoleEnum("role").notNull().default("player"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.campaignId, t.userId)] // one membership per user per campaign
);

// Flexible key/value config per campaign (e.g. discord_webhook_url, reservation_expiry_days)
export const campaignSettings = pgTable(
  "campaign_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value"),
  },
  (t) => [unique().on(t.campaignId, t.key)]
);

// ─── Characters ───────────────────────────────────────────────────────────────

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  status: characterStatusEnum("status").notNull().default("active"),
  archivedAt: timestamp("archived_at"),
  ...timestamps,
});

// ─── World Entities ───────────────────────────────────────────────────────────
// Locations, NPCs, and Artifacts are the three persistent world entity types.
// Their narrative history lives in journal_entries, not in these tables.

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: locationStatusEnum("status").notNull().default("open"),
  parentLocationId: uuid("parent_location_id"), // self-ref, filled via relation
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  archivedAt: timestamp("archived_at"),
  ...timestamps,
});

export const locationConnections = pgTable(
  "location_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromLocationId: uuid("from_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    toLocationId: uuid("to_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    description: text("description"), // e.g. "3-day journey through the marshes"
  },
  (t) => [unique().on(t.fromLocationId, t.toLocationId)]
);

export const npcs = pgTable("npcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: npcStatusEnum("status").notNull().default("alive"),
  locationId: uuid("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  archivedAt: timestamp("archived_at"),
  ...timestamps,
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: artifactStatusEnum("status").notNull().default("extant"),
  locationId: uuid("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  archivedAt: timestamp("archived_at"),
  ...timestamps,
});

// ─── Expeditions ──────────────────────────────────────────────────────────────

export const expeditions = pgTable("expeditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  gmId: uuid("gm_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  premise: text("premise"), // brief GM statement of intent — used for conflict detection
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  status: expeditionStatusEnum("status").notNull().default("recruiting"),
  ...timestamps,
});

// Join tables: what an expedition targets (conflict detection surface)
export const expeditionParticipants = pgTable(
  "expedition_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expeditionId: uuid("expedition_id")
      .notNull()
      .references(() => expeditions.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.expeditionId, t.characterId)]
);

export const expeditionLocations = pgTable(
  "expedition_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expeditionId: uuid("expedition_id")
      .notNull()
      .references(() => expeditions.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.expeditionId, t.locationId)]
);

export const expeditionNpcs = pgTable(
  "expedition_npcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expeditionId: uuid("expedition_id")
      .notNull()
      .references(() => expeditions.id, { onDelete: "cascade" }),
    npcId: uuid("npc_id")
      .notNull()
      .references(() => npcs.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.expeditionId, t.npcId)]
);

export const expeditionArtifacts = pgTable(
  "expedition_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expeditionId: uuid("expedition_id")
      .notNull()
      .references(() => expeditions.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.expeditionId, t.artifactId)]
);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  expeditionId: uuid("expedition_id")
    .notNull()
    .references(() => expeditions.id),
  gmId: uuid("gm_id")
    .notNull()
    .references(() => users.id),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  campaignDay: integer("campaign_day"), // in-world day number, set by GM
  playedAt: timestamp("played_at", { withTimezone: true }),
  status: sessionStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const sessionParticipants = pgTable(
  "session_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id),
  },
  (t) => [unique().on(t.sessionId, t.characterId)]
);

// ─── Session Reports ──────────────────────────────────────────────────────────

export const sessionReports = pgTable("session_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .unique() // one report per session
    .references(() => sessions.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  status: reportStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

// One note per player per session, GM-only visibility by default
export const sessionPlayerNotes = pgTable(
  "session_player_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => users.id),
    characterId: uuid("character_id").references(() => characters.id),
    body: text("body").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.sessionId, t.playerId)] // enforced: one note per player per session
);

// ─── World Changes ────────────────────────────────────────────────────────────
// Proposed structured changes within a session report.
// Publishing a report converts pending world changes into world events.

export const worldChanges = pgTable("world_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionReportId: uuid("session_report_id")
    .notNull()
    .references(() => sessionReports.id, { onDelete: "cascade" }),
  changeType: worldChangeTypeEnum("change_type").notNull(),
  entityType: text("entity_type").notNull(), // 'location' | 'npc' | 'artifact' | 'campaign'
  entityId: uuid("entity_id"), // FK to the affected entity (nullable for campaign-wide changes)
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // type-specific fields: { new_status, npc_name, structure_name, etc. }
  status: worldChangeStatusEnum("status").notNull().default("pending"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

// ─── World Events ─────────────────────────────────────────────────────────────
// Permanent timeline entries created when world changes are published.

export const worldEvents = pgTable("world_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  worldChangeId: uuid("world_change_id").references(() => worldChanges.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  campaignDay: integer("campaign_day"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Journal Entries ──────────────────────────────────────────────────────────
// Cross-cutting narrative record system.
// GMs and players can add entries to any world entity.
// author_role is snapshotted at write time for historical accuracy.

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  authorRole: journalAuthorRoleEnum("author_role").notNull(), // snapshot
  entityType: journalEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  visibility: journalVisibilityEnum("visibility").notNull().default("public"),
  body: text("body").notNull(),
  campaignDay: integer("campaign_day"),
  pinned: boolean("pinned").notNull().default(false),
  edited: boolean("edited").notNull().default(false),
  ...timestamps,
});

// ─── Activity Log ─────────────────────────────────────────────────────────────
// Append-only audit trail. Also drives the activity feed and future integrations.

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  actionType: text("action_type").notNull(), // e.g. 'expedition.created', 'world_event.published'
  entityType: text("entity_type"), // e.g. 'expedition', 'location'
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"), // full snapshot of what changed
  gmOnly: boolean("gm_only").notNull().default(false), // hidden from players/observers
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  campaignMembers: many(campaignMembers),
  characters: many(characters),
  expeditions: many(expeditions),
  journalEntries: many(journalEntries),
}));

export const campaignMembersRelations = relations(campaignMembers, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignMembers.campaignId],
    references: [campaigns.id],
  }),
  user: one(users, {
    fields: [campaignMembers.userId],
    references: [users.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  members: many(campaignMembers),
  settings: many(campaignSettings),
  locations: many(locations),
  npcs: many(npcs),
  artifacts: many(artifacts),
  expeditions: many(expeditions),
  worldEvents: many(worldEvents),
  journalEntries: many(journalEntries),
  activityLog: many(activityLog),
}));

export const expeditionsRelations = relations(expeditions, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [expeditions.campaignId],
    references: [campaigns.id],
  }),
  gm: one(users, { fields: [expeditions.gmId], references: [users.id] }),
  participants: many(expeditionParticipants),
  locations: many(expeditionLocations),
  npcs: many(expeditionNpcs),
  artifacts: many(expeditionArtifacts),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  expedition: one(expeditions, {
    fields: [sessions.expeditionId],
    references: [expeditions.id],
  }),
  campaign: one(campaigns, {
    fields: [sessions.campaignId],
    references: [campaigns.id],
  }),
  gm: one(users, { fields: [sessions.gmId], references: [users.id] }),
  participants: many(sessionParticipants),
  report: one(sessionReports, {
    fields: [sessions.id],
    references: [sessionReports.sessionId],
  }),
  playerNotes: many(sessionPlayerNotes),
}));

export const sessionReportsRelations = relations(
  sessionReports,
  ({ one, many }) => ({
    session: one(sessions, {
      fields: [sessionReports.sessionId],
      references: [sessions.id],
    }),
    author: one(users, {
      fields: [sessionReports.authorId],
      references: [users.id],
    }),
    worldChanges: many(worldChanges),
  })
);

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  author: one(users, {
    fields: [journalEntries.authorId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [journalEntries.campaignId],
    references: [campaigns.id],
  }),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  player: one(users, {
    fields: [characters.playerId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [characters.campaignId],
    references: [campaigns.id],
  }),
}));

export const expeditionLocationsRelations = relations(
  expeditionLocations,
  ({ one }) => ({
    expedition: one(expeditions, {
      fields: [expeditionLocations.expeditionId],
      references: [expeditions.id],
    }),
    location: one(locations, {
      fields: [expeditionLocations.locationId],
      references: [locations.id],
    }),
  })
);

export const expeditionNpcsRelations = relations(expeditionNpcs, ({ one }) => ({
  expedition: one(expeditions, {
    fields: [expeditionNpcs.expeditionId],
    references: [expeditions.id],
  }),
  npc: one(npcs, {
    fields: [expeditionNpcs.npcId],
    references: [npcs.id],
  }),
}));

export const expeditionArtifactsRelations = relations(
  expeditionArtifacts,
  ({ one }) => ({
    expedition: one(expeditions, {
      fields: [expeditionArtifacts.expeditionId],
      references: [expeditions.id],
    }),
    artifact: one(artifacts, {
      fields: [expeditionArtifacts.artifactId],
      references: [artifacts.id],
    }),
  })
);

export const expeditionParticipantsRelations = relations(
  expeditionParticipants,
  ({ one }) => ({
    expedition: one(expeditions, {
      fields: [expeditionParticipants.expeditionId],
      references: [expeditions.id],
    }),
    character: one(characters, {
      fields: [expeditionParticipants.characterId],
      references: [characters.id],
    }),
  })
);

export const sessionParticipantsRelations = relations(
  sessionParticipants,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionParticipants.sessionId],
      references: [sessions.id],
    }),
    character: one(characters, {
      fields: [sessionParticipants.characterId],
      references: [characters.id],
    }),
  })
);

export const sessionPlayerNotesRelations = relations(
  sessionPlayerNotes,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionPlayerNotes.sessionId],
      references: [sessions.id],
    }),
    player: one(users, {
      fields: [sessionPlayerNotes.playerId],
      references: [users.id],
    }),
    character: one(characters, {
      fields: [sessionPlayerNotes.characterId],
      references: [characters.id],
    }),
  })
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [locations.campaignId],
    references: [campaigns.id],
  }),
  parent: one(locations, {
    fields: [locations.parentLocationId],
    references: [locations.id],
    relationName: "location_parent",
  }),
  children: many(locations, { relationName: "location_parent" }),
  connectionsFrom: many(locationConnections, { relationName: "connection_from" }),
}));

export const locationConnectionsRelations = relations(locationConnections, ({ one }) => ({
  fromLocation: one(locations, {
    fields: [locationConnections.fromLocationId],
    references: [locations.id],
    relationName: "connection_from",
  }),
  toLocation: one(locations, {
    fields: [locationConnections.toLocationId],
    references: [locations.id],
  }),
}));

export const npcsRelations = relations(npcs, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [npcs.campaignId],
    references: [campaigns.id],
  }),
  location: one(locations, {
    fields: [npcs.locationId],
    references: [locations.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [artifacts.campaignId],
    references: [campaigns.id],
  }),
  location: one(locations, {
    fields: [artifacts.locationId],
    references: [locations.id],
  }),
}));

export const worldEventsRelations = relations(worldEvents, ({ one }) => ({  campaign: one(campaigns, {
    fields: [worldEvents.campaignId],
    references: [campaigns.id],
  }),
  session: one(sessions, {
    fields: [worldEvents.sessionId],
    references: [sessions.id],
  }),
  createdBy: one(users, {
    fields: [worldEvents.createdBy],
    references: [users.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [activityLog.campaignId],
    references: [campaigns.id],
  }),
  actor: one(users, {
    fields: [activityLog.actorId],
    references: [users.id],
  }),
}));

export const worldChangesRelations = relations(worldChanges, ({ one }) => ({
  sessionReport: one(sessionReports, {
    fields: [worldChanges.sessionReportId],
    references: [sessionReports.id],
  }),
  createdBy: one(users, {
    fields: [worldChanges.createdBy],
    references: [users.id],
  }),
}));
