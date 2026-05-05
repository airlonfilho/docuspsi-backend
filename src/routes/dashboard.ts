import { Router } from "express";
import { db, patientsTable, documentsTable, documentTemplatesTable, leadsTable, leadEventsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/stats", async (req, res) => {
  try {
    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.userId!));
    const documents = await db.select().from(documentsTable).where(eq(documentsTable.userId, req.userId!));

    const stats = {
      totalPatients: patients.length,
      totalDocuments: documents.length,
      documentsDraft: documents.filter(d => d.status === "rascunho").length,
      documentsGenerated: documents.filter(d => d.status === "gerado" || d.status === "enviado").length,
      documentsAwaitingAcceptance: documents.filter(d => d.status === "aguardando_aceite").length,
      documentsAccepted: documents.filter(d => d.status === "aceito").length,
      documentsRevoked: documents.filter(d => d.status === "revogado").length,
    };

    res.json(stats);
  } catch (err) {
    req.log.error(err, "Dashboard stats error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar estatísticas" });
  }
});

router.get("/recent-documents", async (req, res) => {
  try {
    const docs = await db.select().from(documentsTable)
      .where(eq(documentsTable.userId, req.userId!))
      .orderBy(desc(documentsTable.createdAt))
      .limit(10);

    const docsWithRelations = await Promise.all(docs.map(async (doc) => {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
      const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, doc.templateId)).limit(1);
      return { ...doc, patient, template };
    }));

    res.json(docsWithRelations);
  } catch (err) {
    req.log.error(err, "Recent documents error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar documentos recentes" });
  }
});

router.get("/leads", async (req, res) => {
  try {
    const leads = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
    const events = await db.select().from(leadEventsTable).orderBy(desc(leadEventsTable.createdAt));

    const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {});

    const leadsWithEvents = leads.map((lead) => {
      const leadEvents = events.filter((event) => event.leadId === lead.id);
      return {
        ...lead,
        events: leadEvents,
        eventsCount: leadEvents.length,
        lastEventAt: leadEvents[0]?.createdAt || null,
      };
    });

    res.json({
      summary: {
        totalLeads: leads.length,
        downloadedKit: leads.filter((lead) => lead.downloadedKit).length,
        consented: leads.filter((lead) => lead.consent).length,
        eventCounts,
      },
      leads: leadsWithEvents,
    });
  } catch (err) {
    req.log.error(err, "Dashboard leads error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar leads" });
  }
});

export default router;
