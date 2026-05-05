import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const useCasesTable = pgTable("use_cases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUseCaseSchema = createInsertSchema(useCasesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUseCase = z.infer<typeof insertUseCaseSchema>;
export type UseCase = typeof useCasesTable.$inferSelect;
