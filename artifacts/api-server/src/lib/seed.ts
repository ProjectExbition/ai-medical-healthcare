import { db, appointmentsTable, doctorsTable, predictionsTable, recordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PATIENT = "Varad Jadhav";

export async function seedDemoData(): Promise<void> {
  const existingDoctors = await db.select({ id: doctorsTable.id }).from(doctorsTable);
  if (existingDoctors.length === 0) {
    await db.insert(doctorsTable).values([
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
    ]);
  }

  const existingAppointments = await db.select({ id: appointmentsTable.id }).from(appointmentsTable);
  if (existingAppointments.length === 0) {
    const doctors = await db.select().from(doctorsTable);
    await db.insert(appointmentsTable).values([
      {
        doctorId: doctors[0].id,
        patientName: PATIENT,
        date: "2026-10-02",
        time: "4:30 PM",
        reason: "Follow-up on recent fatigue and sleep changes",
        status: "upcoming",
      },
      {
        doctorId: doctors[1].id,
        patientName: PATIENT,
        date: "2026-08-18",
        time: "11:30 AM",
        reason: "Routine heart health consultation",
        status: "completed",
      },
    ]);
  }

  const existingRecords = await db.select({ id: recordsTable.id }).from(recordsTable).where(eq(recordsTable.patientName, PATIENT));
  if (existingRecords.length === 0) {
    await db.insert(recordsTable).values([
      {
        patientName: PATIENT,
        recordType: "lab",
        title: "Complete blood count",
        provider: "VitaCare Diagnostics",
        date: "2026-09-18",
        summary: "Routine screening panel. Your care team can explain these results in context.",
        status: "active",
      },
      {
        patientName: PATIENT,
        recordType: "visit",
        title: "Annual wellness visit",
        provider: "Dr. Ananya Sharma",
        date: "2026-08-30",
        summary: "Preventive visit with lifestyle and sleep recommendations.",
        status: "active",
      },
      {
        patientName: PATIENT,
        recordType: "prescription",
        title: "Current medications",
        provider: "Dr. Rohan Mehta",
        date: "2026-07-12",
        summary: "Medication list is available for review with your care team.",
        status: "archived",
      },
    ]);
  }

  const existingPredictions = await db.select({ id: predictionsTable.id }).from(predictionsTable).where(eq(predictionsTable.patientName, PATIENT));
  if (existingPredictions.length === 0) {
    await db.insert(predictionsTable).values([
      {
        patientName: PATIENT,
        symptoms: ["Fatigue", "Headache"],
        condition: "General wellness check",
        confidence: 58,
        associatedSymptoms: ["Fatigue", "Headache", "Difficulty concentrating"],
        recommendation: "Track how you feel, rest, hydrate, and consult a qualified healthcare professional for personalized advice.",
        urgency: "routine",
      },
    ]);
  }
}