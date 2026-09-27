import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recordsTable = pgTable("medical_records", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  recordType: text("record_type").notNull(),
  title: text("title").notNull(),
  provider: text("provider").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecordSchema = createInsertSchema(recordsTable).omit({ id: true, createdAt: true });
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type MedicalRecord = typeof recordsTable.$inferSelect;