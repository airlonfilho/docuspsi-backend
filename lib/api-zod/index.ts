import { z } from "zod";

export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});

export const RegisterBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const CreateProfileBody = z.object({
  fullName: z.string().min(1),
  crp: z.string().min(1),
  professionalEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  clinicName: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  instagram: z.string().optional().or(z.literal("")),
  logoUrl: z.string().optional().nullable(),
  signatureUrl: z.string().optional().nullable(),
  documentPrimaryColor: z.string().optional().or(z.literal("")),
  documentSecondaryColor: z.string().optional().or(z.literal("")),
  defaultCity: z.string().optional().or(z.literal("")),
  defaultState: z.string().optional().or(z.literal("")),
  defaultFooter: z.string().optional().or(z.literal("")),
  defaultSessionDuration: z.coerce.number().int().positive().optional().nullable(),
  defaultSessionValue: z.coerce.number().positive().optional().nullable(),
  defaultPaymentMethod: z.string().optional().or(z.literal("")),
  defaultCancellationPolicy: z.string().optional().or(z.literal("")),
  showGeneratedBy: z.boolean().optional(),
  showDocumentCode: z.boolean().optional(),
  showIssuedAt: z.boolean().optional(),
  showPageNumber: z.boolean().optional(),
});

export const CreatePatientBody = z.object({
  name: z.string().optional().or(z.literal("")),
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  cpf: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  serviceType: z.enum(["presencial", "online", "hibrido"]).optional(),
});

export const UpdatePatientBody = CreatePatientBody.partial();
export const GetPatientParams = z.object({ patientId: z.string().min(1) });
export const UpdatePatientParams = GetPatientParams;
export const DeletePatientParams = GetPatientParams;
export const ListPatientsQueryParams = z.object({
  search: z.string().optional(),
  serviceType: z.enum(["presencial", "online", "hibrido"]).optional(),
});

export const GetTemplateParams = z.object({ slug: z.string().min(1) });

export const CreateDocumentBody = z.object({
  title: z.string().min(1),
  patientId: z.string().min(1),
  templateId: z.string().min(1),
  formData: z.record(z.any()).optional(),
});

export const UpdateDocumentBody = z.object({
  title: z.string().min(1).optional(),
  formData: z.record(z.any()).optional(),
  status: z.enum(["rascunho", "gerado", "enviado", "aguardando_aceite", "aceito", "revogado"]).optional(),
});

export const GetDocumentParams = z.object({ documentId: z.string().min(1) });
export const UpdateDocumentParams = GetDocumentParams;
export const ListDocumentsQueryParams = z.object({
  patientId: z.string().optional(),
  templateType: z.string().optional(),
  status: z.enum(["rascunho", "gerado", "enviado", "aguardando_aceite", "aceito", "revogado"]).optional(),
});

export const GetPublicDocumentParams = z.object({ token: z.string().min(1) });
export const AcceptDocumentParams = z.object({ token: z.string().min(1) });
export const AcceptDocumentBody = z.object({
  patientName: z.string().min(1).optional(),
  acceptedName: z.string().min(1).optional(),
  patientEmail: z.string().email().optional().or(z.literal("")),
  acceptedEmail: z.string().email().optional().or(z.literal("")),
  acceptedCpf: z.string().optional().or(z.literal("")),
});

export type RegisterBody = z.infer<typeof RegisterBody>;
export type LoginBody = z.infer<typeof LoginBody>;
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;
export type CreateProfileBody = z.infer<typeof CreateProfileBody>;
export type CreatePatientBody = z.infer<typeof CreatePatientBody>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientBody>;
export type GetPatientParams = z.infer<typeof GetPatientParams>;
export type UpdatePatientParams = z.infer<typeof UpdatePatientParams>;
export type DeletePatientParams = z.infer<typeof DeletePatientParams>;
export type ListPatientsQueryParams = z.infer<typeof ListPatientsQueryParams>;
export type GetTemplateParams = z.infer<typeof GetTemplateParams>;
export type CreateDocumentBody = z.infer<typeof CreateDocumentBody>;
export type UpdateDocumentBody = z.infer<typeof UpdateDocumentBody>;
export type GetDocumentParams = z.infer<typeof GetDocumentParams>;
export type UpdateDocumentParams = z.infer<typeof UpdateDocumentParams>;
export type ListDocumentsQueryParams = z.infer<typeof ListDocumentsQueryParams>;
export type GetPublicDocumentParams = z.infer<typeof GetPublicDocumentParams>;
export type AcceptDocumentParams = z.infer<typeof AcceptDocumentParams>;
export type AcceptDocumentBody = z.infer<typeof AcceptDocumentBody>;