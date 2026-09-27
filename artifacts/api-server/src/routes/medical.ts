import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, appointmentsTable, doctorsTable, predictionsTable, recordsTable } from "@workspace/db";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreatePredictionBody,
  CreatePredictionResponse,
  CreateRecordBody,
  CreateRecordResponse,
  DeleteRecordParams,
  GetAdminOverviewResponse,
  GetDashboardResponse,
  ListAppointmentsResponse,
  ListDoctorsResponse,
  ListPredictionsResponse,
  ListRecordsResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
  UpdateRecordBody,
  UpdateRecordParams,
  UpdateRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const CURRENT_PATIENT = "Varad Jadhav";

const doctorSeed = [
  {
    name: "Dr. Ananya Sharma",
    specialty: "General Medicine",
    initials: "AS",
    accent: "mint",
    nextAvailable: "Today, 4:30 PM",
    availableSlots: ["4:30 PM", "5:15 PM", "6:00 PM"],
  },
  {
    name: "Dr. Rohan Mehta",
    specialty: "Cardiology",
    initials: "RM",
    accent: "blue",
    nextAvailable: "Tomorrow, 10:00 AM",
    availableSlots: ["10:00 AM", "11:30 AM", "2:00 PM"],
  },
  {
    name: "Dr. Meera Iyer",
    specialty: "Dermatology",
    initials: "MI",
    accent: "peach",
    nextAvailable: "Wed, 9:15 AM",
    availableSlots: ["9:15 AM", "10:00 AM", "12:30 PM"],
  },
];

type DoctorRow = typeof doctorsTable.$inferSelect;
type AppointmentRow = typeof appointmentsTable.$inferSelect;
type PredictionRow = typeof predictionsTable.$inferSelect;
type RecordRow = typeof recordsTable.$inferSelect;

function toDoctor(row: DoctorRow) {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    initials: row.initials,
    accent: row.accent,
    nextAvailable: row.nextAvailable,
    availableSlots: row.availableSlots,
  };
}

function toPrediction(row: PredictionRow) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    symptoms: row.symptoms,
    condition: row.condition,
    confidence: row.confidence,
    associatedSymptoms: row.associatedSymptoms,
    recommendation: row.recommendation,
    urgency: row.urgency as "routine" | "attention" | "urgent",
  };
}

function toRecord(row: RecordRow) {
  return {
    id: row.id,
    recordType: row.recordType as "visit" | "lab" | "prescription" | "note",
    title: row.title,
    provider: row.provider,
    date: row.date,
    summary: row.summary,
    status: row.status as "active" | "archived",
  };
}

function toAppointment(row: AppointmentRow, doctor?: DoctorRow) {
  return {
    id: row.id,
    doctorId: row.doctorId,
    doctorName: doctor?.name ?? "Care team",
    specialty: doctor?.specialty ?? "Healthcare",
    date: row.date,
    time: row.time,
    reason: row.reason,
    status: row.status as "upcoming" | "completed" | "cancelled",
  };
}

async function getDoctors() {
  const doctors = await db.select().from(doctorsTable).orderBy(doctorsTable.id);
  if (doctors.length > 0) return doctors;
  const inserted = await db.insert(doctorsTable).values(doctorSeed).returning();
  return inserted;
}

async function getAppointmentRows() {
  const [appointments, doctors] = await Promise.all([
    db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.date), appointmentsTable.time),
    getDoctors(),
  ]);
  return appointments.map((appointment) => ({
    appointment,
    doctor: doctors.find((doctor) => doctor.id === appointment.doctorId),
  }));
}

function predictionFor(symptoms: string[], otherSymptoms?: string) {
  const lower = symptoms.map((symptom) => symptom.toLowerCase());
  const has = (term: string) => lower.includes(term);
  if (has("chest pain") || has("shortness of breath")) {
    return {
      condition: "Needs prompt clinical attention",
      confidence: 86,
      associatedSymptoms: ["Chest discomfort", "Shortness of breath", "Fatigue"],
      recommendation: "If symptoms are severe, sudden, or worsening, seek emergency care now. Otherwise, contact a qualified healthcare professional promptly.",
      urgency: "urgent" as const,
    };
  }
  if (has("fever") && has("cough") && has("fatigue")) {
    return {
      condition: "Respiratory infection pattern",
      confidence: 78,
      associatedSymptoms: ["Fever", "Cough", "Fatigue", "Sore throat"],
      recommendation: "Rest, stay hydrated, monitor your temperature, and speak with a clinician if symptoms persist or worsen.",
      urgency: "attention" as const,
    };
  }
  if (has("stomach pain") || has("nausea")) {
    return {
      condition: "Digestive discomfort pattern",
      confidence: 71,
      associatedSymptoms: ["Nausea", "Stomach pain", "Fatigue"],
      recommendation: "Take small sips of water, choose light foods, and consult a clinician if pain is severe, persistent, or accompanied by other concerning symptoms.",
      urgency: "routine" as const,
    };
  }
  return {
    condition: "General wellness check",
    confidence: Math.min(68, 48 + symptoms.length * 5),
    associatedSymptoms: [...symptoms.slice(0, 4), ...(otherSymptoms ? [otherSymptoms] : [])],
    recommendation: "Track how you feel, rest, hydrate, and consult a qualified healthcare professional for personalized advice.",
    urgency: "routine" as const,
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [appointments, records, predictions] = await Promise.all([
    getAppointmentRows(),
    db.select().from(recordsTable).where(eq(recordsTable.patientName, CURRENT_PATIENT)).orderBy(desc(recordsTable.date)),
    db.select().from(predictionsTable).where(eq(predictionsTable.patientName, CURRENT_PATIENT)).orderBy(desc(predictionsTable.createdAt)),
  ]);
  const upcoming = appointments.find(({ appointment }) => appointment.status === "upcoming");
  const dashboard = {
    patientName: CURRENT_PATIENT,
    totalAppointments: appointments.length,
    recordsCount: records.length,
    upcomingAppointment: upcoming ? toAppointment(upcoming.appointment, upcoming.doctor) : null,
    recentPrediction: predictions[0] ? toPrediction(predictions[0]) : null,
    wellnessScore: 82,
    profileCompletion: 76,
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [appointments, records] = await Promise.all([
    db.select().from(appointmentsTable),
    db.select().from(recordsTable),
  ]);
  const statuses = ["upcoming", "completed", "cancelled"];
  const overview = {
    patientCount: 24,
    appointmentCount: appointments.length,
    pendingAppointments: appointments.filter((appointment) => appointment.status === "upcoming").length,
    recordsAddedThisWeek: records.filter((record) => record.status === "active").length,
    appointmentsByStatus: statuses.map((label) => ({
      label,
      value: appointments.filter((appointment) => appointment.status === label).length,
    })),
  };
  res.json(GetAdminOverviewResponse.parse(overview));
});

router.get("/doctors", async (_req, res): Promise<void> => {
  const doctors = await getDoctors();
  res.json(ListDoctorsResponse.parse(doctors.map(toDoctor)));
});

router.get("/appointments", async (_req, res): Promise<void> => {
  const appointments = await getAppointmentRows();
  res.json(ListAppointmentsResponse.parse(appointments.map(({ appointment, doctor }) => toAppointment(appointment, doctor))));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const doctors = await getDoctors();
  const doctor = doctors.find((item) => item.id === parsed.data.doctorId);
  if (!doctor) {
    res.status(400).json({ error: "Doctor not found" });
    return;
  }
  const [appointment] = await db.insert(appointmentsTable).values({
    ...parsed.data,
    patientName: CURRENT_PATIENT,
  }).returning();
  res.status(201).json(CreateAppointmentResponse.parse(toAppointment(appointment, doctor)));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [appointment] = await db.update(appointmentsTable)
    .set(parsed.data)
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  const doctors = await getDoctors();
  res.json(UpdateAppointmentResponse.parse(toAppointment(appointment, doctors.find((doctor) => doctor.id === appointment.doctorId))));
});

router.get("/records", async (_req, res): Promise<void> => {
  const records = await db.select().from(recordsTable).where(eq(recordsTable.patientName, CURRENT_PATIENT)).orderBy(desc(recordsTable.date));
  res.json(ListRecordsResponse.parse(records.map(toRecord)));
});

router.post("/records", async (req, res): Promise<void> => {
  const parsed = CreateRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db.insert(recordsTable).values({
    ...parsed.data,
    patientName: CURRENT_PATIENT,
  }).returning();
  res.status(201).json(CreateRecordResponse.parse(toRecord(record)));
});

router.patch("/records/:id", async (req, res): Promise<void> => {
  const params = UpdateRecordParams.safeParse(req.params);
  const parsed = UpdateRecordBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db.update(recordsTable)
    .set(parsed.data)
    .where(and(eq(recordsTable.id, params.data.id), eq(recordsTable.patientName, CURRENT_PATIENT)))
    .returning();
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(UpdateRecordResponse.parse(toRecord(record)));
});

router.delete("/records/:id", async (req, res): Promise<void> => {
  const params = DeleteRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [record] = await db.delete(recordsTable)
    .where(and(eq(recordsTable.id, params.data.id), eq(recordsTable.patientName, CURRENT_PATIENT)))
    .returning();
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/predictions", async (_req, res): Promise<void> => {
  const predictions = await db.select().from(predictionsTable).where(eq(predictionsTable.patientName, CURRENT_PATIENT)).orderBy(desc(predictionsTable.createdAt));
  res.json(ListPredictionsResponse.parse(predictions.map(toPrediction)));
});

router.post("/predictions", async (req, res): Promise<void> => {
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = predictionFor(parsed.data.symptoms, parsed.data.otherSymptoms);
  const [prediction] = await db.insert(predictionsTable).values({
    patientName: CURRENT_PATIENT,
    symptoms: parsed.data.symptoms,
    condition: result.condition,
    confidence: result.confidence,
    associatedSymptoms: result.associatedSymptoms,
    recommendation: result.recommendation,
    urgency: result.urgency,
  }).returning();
  res.status(201).json(CreatePredictionResponse.parse(toPrediction(prediction)));
});

export default router;