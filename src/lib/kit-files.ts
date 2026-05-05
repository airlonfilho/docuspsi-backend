import { readFile } from "node:fs/promises";
import path from "node:path";

export const kitArchiveFilename = "docuspsi_kit_documental.zip";

export const kitFileDefinitions = [
  {
    name: "Checklist Documental DocusPsi",
    filename: "01_Checklist_Documental_DocusPsi.docx",
  },
  {
    name: "Contrato Terapeutico DocusPsi",
    filename: "02_Contrato_Terapeutico_DocusPsi.docx",
  },
  {
    name: "Termo de Consentimento DocusPsi",
    filename: "03_Termo_Consentimento_DocusPsi.docx",
  },
  {
    name: "Termo de Atendimento Online DocusPsi",
    filename: "04_Termo_Atendimento_Online_DocusPsi.docx",
  },
  {
    name: "Autorizacao Menor DocusPsi",
    filename: "05_Autorizacao_Menor_DocusPsi.docx",
  },
  {
    name: "Recibo Pagamento DocusPsi",
    filename: "06_Recibo_Pagamento_DocusPsi.docx",
  },
  {
    name: "Declaracao Comparecimento DocusPsi",
    filename: "07_Declaracao_Comparecimento_DocusPsi.docx",
  },
  {
    name: "Guia Organizacao Paciente DocusPsi",
    filename: "08_Guia_Organizacao_Paciente_DocusPsi.docx",
  },
  {
    name: "Referencias e Uso DocusPsi",
    filename: "09_Referencias_e_Uso_DocusPsi.docx",
  },
] as const;

export async function createKitZip(): Promise<Buffer> {
  const archivePath = path.resolve(process.cwd(), "src", "public", kitArchiveFilename);
  return readFile(archivePath);
}
