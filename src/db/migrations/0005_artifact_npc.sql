ALTER TABLE "artifacts" ADD COLUMN "npc_id" uuid REFERENCES "npcs"("id") ON DELETE SET NULL;
