import { db } from "../db/index.js";
import { worldEvents } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type WorldEvent = InferSelectModel<typeof worldEvents>;

export async function getWorldEvents(campaignId: string) {
  return db.query.worldEvents.findMany({
    where: eq(worldEvents.campaignId, campaignId),
    orderBy: [desc(worldEvents.campaignDay), desc(worldEvents.createdAt)],
    with: {
      createdBy: { columns: { id: true, displayName: true } },
      session: {
        columns: { id: true },
        with: {
          expedition: { columns: { id: true, title: true } },
        },
      },
    },
  });
}
