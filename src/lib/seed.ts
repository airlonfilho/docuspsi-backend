import { db, usersTable, professionalProfilesTable, patientsTable, documentTemplatesTable, documentsTable } from "@workspace/db";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

const TEMPLATES = [
  {
    id: "tpl-1",
    name: "Contrato Terapêutico",
    slug: "contrato-terapeutico",
    description: "Formaliza a relação terapêutica, define valores, cancelamentos e direitos de ambas as partes.",
    category: "Contrato",
    type: "contrato",
    contentHtml: `<section><h2>CONTRATO TERAPÊUTICO</h2><p>Entre em baixo nominados contratante e contratada, fica ajustado o presente contrato:</p><h3>Dados do Profissional</h3><p><strong>{{professional.fullName}}</strong></p><p>CRP: {{professional.crp}}</p><h3>Dados do Paciente</h3><p><strong>{{patient.fullName}}</strong></p><p>E-mail: {{patient.email}}</p><h3>Condições do Atendimento</h3><ul><li>Valor da sessão: {{session.value}}</li><li>Duração: {{session.duration}}</li><li>Modalidade: {{session.modality}}</li><li>Frequência: {{session.frequency}}</li></ul><h3>Forma de Pagamento</h3><p>{{payment.method}}</p><h3>Política de Cancelamento</h3><p>{{cancellation.policy}}</p></section>`,
    fieldsSchema: {
      fields: [
        { key: "sessionValue", label: "Valor da sessão (R$)", type: "number", required: true },
        { key: "sessionDuration", label: "Duração da sessão (minutos)", type: "number", required: true, default: "50" },
        { key: "modality", label: "Modalidade", type: "select", required: true, options: ["presencial", "online", "hibrido"] },
        { key: "paymentMethod", label: "Forma de pagamento", type: "text", required: true },
        { key: "cancellationPolicy", label: "Política de cancelamento", type: "textarea", required: true },
        { key: "minCancellationTime", label: "Prazo mínimo para cancelamento (horas)", type: "number", required: true, default: "24" },
        { key: "communicationChannel", label: "Canal de comunicação", type: "text", required: true, default: "WhatsApp" },
        { key: "observations", label: "Observações adicionais", type: "textarea", required: false },
      ]
    },
    usageNotes: "Modelo para formalizar combinados da prática clínica.",
    isActive: true,
  },
  {
    id: "tpl-2",
    name: "Termo de Consentimento",
    slug: "termo-consentimento",
    description: "Garante o consentimento informado do paciente para o tratamento psicológico.",
    category: "Termo",
    type: "termo",
    contentHtml: `<section><h2>TERMO DE CONSENTIMENTO LIVRE E INFORMADO</h2><p>Declaro estar ciente de que estou iniciando um processo de atendimento psicológico com <strong>{{professional.fullName}}</strong>, CRP {{professional.crp}}.</p><h3>Modalidade de Atendimento</h3><p>{{session.modality}}</p><p>Compreendo que:</p><ul><li>O atendimento é confidencial;</li><li>Existem limitações legais à confidencialidade;</li><li>Posso interromper o atendimento a qualquer momento.</li></ul></section>`,
    fieldsSchema: {
      fields: [
        { key: "modality", label: "Modalidade de atendimento", type: "select", required: true, options: ["presencial", "online", "hibrido"] },
        { key: "purpose", label: "Finalidade do atendimento", type: "text", required: true, default: "Psicoterapia individual" },
        { key: "observations", label: "Observações adicionais", type: "textarea", required: false },
      ]
    },
    usageNotes: "Modelo para consentimento informado.",
    isActive: true,
  },
  {
    id: "tpl-3",
    name: "Termo de Atendimento Online",
    slug: "termo-atendimento-online",
    description: "Informa e obtém ciência sobre as particularidades do atendimento psicológico remoto.",
    category: "Termo",
    type: "termo",
    contentHtml: `<section><h2>TERMO DE ATENDIMENTO PSICOLÓGICO ONLINE</h2><p>Ciente das características do atendimento remoto:</p><ul><li>Plataforma: {{online.platform}}</li><li>Canal alternativo: {{online.backupChannel}}</li></ul><p>{{online.emergencyGuidance}}</p></section>`,
    fieldsSchema: {
      fields: [
        { key: "platform", label: "Plataforma utilizada", type: "text", required: true, default: "Google Meet" },
        { key: "backupChannel", label: "Canal alternativo em caso de falha", type: "text", required: true, default: "Telefone" },
        { key: "observations", label: "Orientações e observações adicionais", type: "textarea", required: false },
      ]
    },
    usageNotes: "Modelo para atendimento online.",
    isActive: true,
  },
  {
    id: "tpl-4",
    name: "Autorização para Atendimento de Menor",
    slug: "autorizacao-menor",
    description: "Autorização do responsável legal para atendimento psicológico de paciente menor de idade.",
    category: "Autorização",
    type: "autorizacao",
    contentHtml: `<section><h2>AUTORIZAÇÃO PARA ATENDIMENTO DE MENOR DE IDADE</h2><p>Eu, {{legalGuardian.name}}, CPF {{legalGuardian.cpf}}, autorizo o atendimento psicológico de {{patient.fullName}}, meu(minha) {{legalGuardian.relationship}}.</p><p>Profissional: {{professional.fullName}} - CRP {{professional.crp}}</p></section>`,
    fieldsSchema: {
      fields: [
        { key: "minorName", label: "Nome do menor", type: "text", required: true },
        { key: "minorBirthDate", label: "Data de nascimento do menor", type: "date", required: true },
        { key: "guardianName", label: "Nome do responsável legal", type: "text", required: true },
        { key: "guardianCpf", label: "CPF do responsável", type: "text", required: false },
        { key: "relationship", label: "Grau de parentesco", type: "text", required: true, default: "mãe/pai" },
        { key: "modality", label: "Modalidade de atendimento", type: "select", required: true, options: ["presencial", "online", "hibrido"] },
        { key: "observations", label: "Observações adicionais", type: "textarea", required: false },
      ]
    },
    usageNotes: "Modelo para menores de idade.",
    isActive: true,
  },
  {
    id: "tpl-5",
    name: "Declaração de Comparecimento",
    slug: "declaracao-comparecimento",
    description: "Comprovante oficial de que o paciente compareceu à sessão de atendimento.",
    category: "Declaração",
    type: "declaracao",
    contentHtml: `<section><h2>DECLARAÇÃO DE COMPARECIMENTO</h2><p>Declaro para os devidos fins que {{patient.fullName}} compareceu à sessão de atendimento psicológico em {{document.issueDate}}.</p><p>Profissional: {{professional.fullName}} - CRP {{professional.crp}}</p></section>`,
    fieldsSchema: {
      fields: [
        { key: "sessionDate", label: "Data da sessão", type: "date", required: true },
        { key: "startTime", label: "Horário de início", type: "time", required: true },
        { key: "endTime", label: "Horário de término", type: "time", required: true },
        { key: "modality", label: "Modalidade", type: "select", required: true, options: ["presencial", "online", "hibrido"] },
        { key: "purpose", label: "Finalidade da declaração (opcional)", type: "text", required: false },
      ]
    },
    usageNotes: "Modelo para comprovação de presença.",
    isActive: true,
  },
  {
    id: "tpl-6",
    name: "Recibo de Pagamento",
    slug: "recibo-pagamento",
    description: "Recibo formal de pagamento por serviços psicológicos prestados.",
    category: "Recibo",
    type: "recibo",
    contentHtml: `<section><h2>RECIBO DE PAGAMENTO</h2><p>Recebi de {{patient.fullName}} a quantia de <strong>R$ {{payment.amount}}</strong> referente a {{payment.reference}}.</p><p>Data: {{payment.date}}</p><p>Forma de pagamento: {{payment.method}}</p><p>{{professional.fullName}} - CRP {{professional.crp}}</p></section>`,
    fieldsSchema: {
      fields: [
        { key: "amount", label: "Valor recebido (R$)", type: "number", required: true },
        { key: "paymentDate", label: "Data do pagamento", type: "date", required: true },
        { key: "paymentMethod", label: "Forma de pagamento", type: "text", required: true },
        { key: "reference", label: "Referência do atendimento", type: "text", required: true, default: "Sessão de psicoterapia" },
        { key: "payerDocument", label: "CPF/CNPJ do pagador (opcional)", type: "text", required: false },
      ]
    },
    usageNotes: "Modelo para recibo de pagamento.",
    isActive: true,
  },
];

export async function seedDatabase() {
  logger.info("Seeding database...");

  // Seed templates
  for (const tpl of TEMPLATES) {
    const existing = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.slug, tpl.slug)).limit(1);
    if (existing.length === 0) {
      const now = new Date();
      await db.insert(documentTemplatesTable).values({
        ...tpl,
        createdAt: now,
        updatedAt: now,
      });
      logger.info({ slug: tpl.slug }, "Template seeded");
    }
  }

  // Seed demo user
  const demoEmail = "demo@psidocs.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, demoEmail)).limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("123456", 10);
    const userId = uuidv4();
    const now = new Date();

    await db.insert(usersTable).values({
      id: userId,
      name: "Dra. Ana Lima (Demo)",
      email: demoEmail,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(professionalProfilesTable).values({
      id: uuidv4(),
      userId,
      fullName: "Ana Lima",
      crp: "06/123456",
      professionalEmail: demoEmail,
      phone: "(11) 99999-0000",
      city: "São Paulo",
      state: "SP",
      clinicName: "Consultório Ana Lima",
      defaultSessionDuration: 50,
      defaultSessionValue: 180,
      defaultPaymentMethod: "PIX",
      defaultCancellationPolicy: "Em caso de cancelamento, solicito aviso com pelo menos 24h de antecedência. Faltas sem aviso prévio serão cobradas integralmente.",
      createdAt: now,
      updatedAt: now,
    });

    // Seed demo patients
    const patientIds = [uuidv4(), uuidv4(), uuidv4()];
    await db.insert(patientsTable).values([
      {
        id: patientIds[0],
        userId,
        fullName: "Mariana Souza",
        birthDate: "1990-05-15",
        email: "mariana@exemplo.com",
        phone: "(11) 98888-1111",
        serviceType: "presencial",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: patientIds[1],
        userId,
        fullName: "João Carlos Ferreira",
        birthDate: "1985-11-20",
        email: "joao@exemplo.com",
        phone: "(11) 97777-2222",
        serviceType: "online",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: patientIds[2],
        userId,
        fullName: "Beatriz Oliveira",
        birthDate: "2000-03-08",
        email: "beatriz@exemplo.com",
        phone: "(11) 96666-3333",
        serviceType: "hibrido",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    logger.info("Demo user and patients seeded");
  } else {
    logger.info("Demo data already exists, skipping");
  }

  logger.info("Database seeded successfully");
}
