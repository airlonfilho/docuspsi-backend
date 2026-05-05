import { db } from "@workspace/db";
import { usersTable, professionalProfilesTable, patientsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Capture snapshot of professional data at document creation time
 */
export async function captureProessionalSnapshot(userId: string) {
  try {
    const [user] = await db
      .select({
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        plan: usersTable.plan,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const [profile] = await db
      .select({
        fullName: professionalProfilesTable.fullName,
        crp: professionalProfilesTable.crp,
        city: professionalProfilesTable.city,
        state: professionalProfilesTable.state,
        clinicName: professionalProfilesTable.clinicName,
        website: professionalProfilesTable.website,
        instagram: professionalProfilesTable.instagram,
        phone: professionalProfilesTable.phone,
        logoUrl: professionalProfilesTable.logoUrl,
        signatureUrl: professionalProfilesTable.signatureUrl,
        documentPrimaryColor: professionalProfilesTable.documentPrimaryColor,
        documentSecondaryColor: professionalProfilesTable.documentSecondaryColor,
        defaultCity: professionalProfilesTable.defaultCity,
        defaultState: professionalProfilesTable.defaultState,
        defaultFooter: professionalProfilesTable.defaultFooter,
      })
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, userId))
      .limit(1);

    return {
      userId,
      ...user,
      ...profile,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error(`Failed to capture professional snapshot: ${err}`);
  }
}

/**
 * Capture snapshot of patient data at document creation time
 */
export async function capturePatientSnapshot(patientId: string) {
  try {
    const [patient] = await db
      .select({
        id: patientsTable.id,
        name: patientsTable.name,
        email: patientsTable.email,
        phone: patientsTable.phone,
        birthDate: patientsTable.birthDate,
        cpf: patientsTable.cpf,
        address: patientsTable.address,
        city: patientsTable.city,
        state: patientsTable.state,
      })
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .limit(1);

    if (!patient) {
      throw new Error(`Patient ${patientId} not found`);
    }

    return {
      ...patient,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error(`Failed to capture patient snapshot: ${err}`);
  }
}
