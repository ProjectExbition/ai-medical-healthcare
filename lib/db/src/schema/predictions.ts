import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  symptoms: text("symptoms").array().notNull(),
  condition: text("condition").notNull(),
  confidence: integer("confidence").notNull(),
  associatedSymptoms: text("associated_symptoms").array().notNull(),
  recommendation: text("recommendation").notNull(),
  urgency: text("urgency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;