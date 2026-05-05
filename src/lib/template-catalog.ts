type TemplateSeed = {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  category: string;
  contentHtml: string;
  fieldsSchema: { fields: Array<Record<string, unknown>> };
  structure: { sections: string[] };
  usageNotes: string;
  isActive: boolean;
  modality: string;
  audience: string;
  useCase: string;
  tags: string[];
};

const commonFields = [
  { key: "sessionValue", label: "Valor da sessao", type: "number", required: false },
  { key: "sessionDuration", label: "Duracao da sessao", type: "number", required: false },
  { key: "paymentMethod", label: "Forma de pagamento", type: "text", required: false },
  { key: "paymentDate", label: "Data de pagamento", type: "date", required: false },
  { key: "sessionDate", label: "Data da sessao", type: "date", required: false },
  { key: "observations", label: "Observacoes", type: "textarea", required: false },
];

function templateContent(title: string, purpose: string): string {
  return `
<h2>${title}</h2>
<p>Profissional: {{professional.fullName}} - CRP {{professional.crp}}</p>
<p>Paciente: {{patient.fullName}}</p>
<p>Data de emissao: {{document.issueDate}}</p>
<h3>Finalidade administrativa</h3>
<p>${purpose}</p>
<h3>Dados do atendimento</h3>
<p>Modalidade: {{session.modality}}</p>
<p>Valor: {{session.value}}</p>
<p>Forma de pagamento: {{payment.method}}</p>
<p>Data de pagamento: {{payment.date}}</p>
<h3>Observacoes editaveis</h3>
<p>{{observations}}</p>
<p>Este modelo e uma base editavel de apoio administrativo. A revisao final, adequacao etica e decisao sobre emissao sao responsabilidade exclusiva da(o) profissional.</p>
`.trim();
}

const definitions = [
  ["contrato-terapeutico-presencial", "Contrato Terapeutico Presencial", "Contrato", "presencial", "adulto", "Apoiar combinados administrativos de atendimento presencial."],
  ["contrato-terapeutico-online", "Contrato Terapeutico Online", "Contrato", "online", "adulto", "Apoiar combinados administrativos de atendimento online."],
  ["contrato-terapeutico-infantil", "Contrato Terapeutico Infantil", "Contrato", "presencial", "responsavel", "Apoiar combinados administrativos com responsavel legal."],
  ["contrato-terapeutico-casal", "Contrato Terapeutico Casal", "Contrato", "hibrido", "casal", "Apoiar combinados administrativos de atendimento de casal."],
  ["contrato-terapeutico-familiar", "Contrato Terapeutico Familiar", "Contrato", "hibrido", "familia", "Apoiar combinados administrativos de atendimento familiar."],
  ["termo-consentimento-adulto", "Termo de Consentimento Adulto", "Termo", "hibrido", "adulto", "Registrar ciencia e consentimento para atendimento psicologico."],
  ["termo-consentimento-menor", "Termo de Consentimento Menor", "Termo", "hibrido", "responsavel", "Registrar ciencia do responsavel legal para atendimento de menor."],
  ["termo-consentimento-casal", "Termo de Consentimento Casal", "Termo", "hibrido", "casal", "Registrar ciencia e consentimento em atendimento de casal."],
  ["termo-consentimento-grupo", "Termo de Consentimento Grupo", "Termo", "hibrido", "grupo", "Registrar ciencia e regras administrativas de atendimento em grupo."],
  ["termo-online-psicoterapia-individual", "Termo Online Psicoterapia Individual", "Termo Online", "online", "adulto", "Registrar orientacoes administrativas para atendimento online individual."],
  ["termo-online-menor", "Termo Online Menor", "Termo Online", "online", "responsavel", "Registrar orientacoes administrativas para atendimento online de menor."],
  ["termo-online-casal", "Termo Online Casal", "Termo Online", "online", "casal", "Registrar orientacoes administrativas para atendimento online de casal."],
  ["autorizacao-atendimento-menor", "Autorizacao para Atendimento de Menor", "Autorizacao", "hibrido", "responsavel", "Formalizar autorizacao administrativa de responsavel legal."],
  ["autorizacao-atendimento-online-menor", "Autorizacao Online para Menor", "Autorizacao", "online", "responsavel", "Formalizar autorizacao para atendimento online de menor."],
  ["autorizacao-compartilhamento-informacoes", "Autorizacao de Compartilhamento de Informacoes", "Autorizacao", "hibrido", "adulto", "Registrar autorizacao expressa para compartilhamento limitado de informacoes."],
  ["declaracao-comparecimento", "Declaracao de Comparecimento", "Declaracao", "hibrido", "adulto", "Declarar comparecimento a atendimento em data informada."],
  ["declaracao-atendimento-psicologico", "Declaracao de Atendimento Psicologico", "Declaracao", "hibrido", "adulto", "Declarar existencia de atendimento sem conteudo clinico automatico."],
  ["declaracao-acompanhamento", "Declaracao de Acompanhamento", "Declaracao", "hibrido", "adulto", "Declarar acompanhamento administrativo quando aplicavel."],
  ["declaracao-horas", "Declaracao de Horas", "Declaracao", "hibrido", "adulto", "Declarar periodo/horas de comparecimento informados."],
  ["recibo-sessao-avulsa", "Recibo de Sessao Avulsa", "Recibo", "hibrido", "adulto", "Emitir recibo administrativo de pagamento por sessao avulsa."],
  ["recibo-pacote-sessoes", "Recibo de Pacote de Sessoes", "Recibo", "hibrido", "adulto", "Emitir recibo administrativo para pacote de sessoes."],
  ["recibo-mensalidade", "Recibo de Mensalidade", "Recibo", "hibrido", "adulto", "Emitir recibo administrativo de mensalidade."],
  ["recibo-coparticipacao", "Recibo de Coparticipacao", "Recibo", "hibrido", "adulto", "Emitir recibo administrativo de coparticipacao."],
  ["encaminhamento-profissional", "Encaminhamento Profissional", "Encaminhamento", "hibrido", "adulto", "Apoiar encaminhamento administrativo para outro profissional, sem conclusao clinica automatica."],
  ["encaminhamento-psiquiatria", "Encaminhamento para Psiquiatria", "Encaminhamento", "hibrido", "adulto", "Apoiar encaminhamento administrativo para avaliacao psiquiatrica, sem diagnostico automatico."],
  ["solicitacao-relatorio", "Solicitacao de Relatorio", "Solicitacao", "hibrido", "adulto", "Apoiar solicitacao administrativa de relatorio/documento."],
  ["registro-evolucao-administrativa", "Registro de Evolucao Administrativa", "Registro", "hibrido", "adulto", "Apoiar registro editavel de acompanhamento, sem gerar evolucao clinica automatica."],
] as const;

export const FRONTEND_TEMPLATE_SEEDS: TemplateSeed[] = definitions.map(([slug, name, category, modality, audience, purpose]) => ({
  id: `tpl-${slug}`,
  name,
  slug,
  description: purpose,
  type: category,
  category,
  contentHtml: templateContent(name, purpose),
  fieldsSchema: { fields: commonFields },
  structure: { sections: ["Identificacao", "Finalidade administrativa", "Dados do atendimento", "Observacoes editaveis", "Assinaturas"] },
  usageNotes: "Modelo editavel de apoio administrativo. Nao substitui revisao tecnica, etica e legal da(o) profissional.",
  isActive: true,
  modality,
  audience,
  useCase: purpose,
  tags: [category.toLowerCase(), modality, audience],
}));
