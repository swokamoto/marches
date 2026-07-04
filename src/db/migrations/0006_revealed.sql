ALTER TABLE "locations" ADD COLUMN "revealed" boolean DEFAULT false NOT NULL;
ALTER TABLE "npcs" ADD COLUMN "revealed" boolean DEFAULT false NOT NULL;
ALTER TABLE "artifacts" ADD COLUMN "revealed" boolean DEFAULT false NOT NULL;
