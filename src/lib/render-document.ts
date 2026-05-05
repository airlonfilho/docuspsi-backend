import { DocumentTemplate, Patient, ProfessionalProfile } from "@workspace/db";

interface RenderContext {
  template: DocumentTemplate;
  patient: Patient;
  profile: ProfessionalProfile;
  formData: Record<string, unknown>;
  documentId?: string;
}

export interface FooterPrefs {
  text?: string;
  showGeneratedBy: boolean;
  showDocumentCode: boolean;
  showIssuedAt: boolean;
  showPageNumber: boolean;
}

export interface RenderedDocument {
  title: string;
  type: string;
  slug: string;
  sections: DocumentSection[];
  infoBlock: InfoBlock;
  signatureBlock: SignatureBlock;
  notice: string;
  professionalHeader: ProfessionalHeader;
  issueDate: string;
  documentId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  footerPrefs?: FooterPrefs;
}

export interface ProfessionalHeader {
  fullName: string;
  crp: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  city: string;
  state: string;
  address?: string;
  website?: string;
  instagram?: string;
}

export interface InfoBlock {
  rows: { label: string; value: string }[];
}

export interface DocumentSection {
  title: string;
  content: string;
  highlight?: boolean;
}

export interface SignatureBlock {
  professional: { name: string; crp: string; role: string };
  patient?: { name: string; role: string };
  guardian?: { name: string; role: string };
  city: string;
  state: string;
  date: string;
}

function formatDate(date?: string | Date | null): string {
  if (!date) return "__/__/____";
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  return d.toLocaleDateString("pt-BR");
}

function formatCurrency(value?: number | string | null): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!num || isNaN(num)) return "R$ ___,__";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function numberToWords(value?: number | string | null): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!num || isNaN(num)) return "___";
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
    "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function convertHundreds(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    const parts: string[] = [];
    if (h > 0) parts.push(hundreds[h]);
    if (t >= 2) {
      parts.push(tens[t]);
      if (u > 0) parts.push(units[u]);
    } else if (t === 1) {
      parts.push(units[10 + u]);
    } else if (u > 0) {
      parts.push(units[u]);
    }
    return parts.join(" e ");
  }

  let result = "";
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    const rest = intPart % 1000;
    result = thousands === 1 ? "mil" : `${convertHundreds(thousands)} mil`;
    if (rest > 0) result += ` e ${convertHundreds(rest)}`;
  } else {
    result = convertHundreds(intPart);
  }

  let final = `${result} real${intPart !== 1 ? "is" : ""}`;
  if (decPart > 0) {
    final += ` e ${convertHundreds(decPart)} centavo${decPart !== 1 ? "s" : ""}`;
  }
  return final.charAt(0).toUpperCase() + final.slice(1);
}

function getField(formData: Record<string, unknown>, key: string, fallback = "___"): string {
  const val = formData[key];
  if (val == null || val === "") return fallback;
  return String(val);
}

function modalityLabel(m: string): string {
  if (m === "online") return "online (telepresencial)";
  if (m === "hibrido") return "híbrido (presencial e online)";
  return "presencial";
}

const NOTICE = "Este documento é um modelo de apoio administrativo gerado pelo PsiDocs. Revise todas as informações antes de emitir. A responsabilidade pelo conteúdo final e pela adequação ética e legal é exclusivamente da(o) profissional.";

export function renderDocument(ctx: RenderContext): RenderedDocument {
  const { template, patient, profile, formData, documentId } = ctx;

  const today = new Date().toLocaleDateString("pt-BR");

  const header: ProfessionalHeader = {
    fullName: profile.fullName || "___",
    crp: profile.crp || "___",
    clinicName: profile.clinicName || undefined,
    email: profile.professionalEmail || undefined,
    phone: profile.phone || undefined,
    city: profile.city || "___",
    state: profile.state || "___",
    address: profile.address || undefined,
    website: (profile as any).website || undefined,
    instagram: (profile as any).instagram || undefined,
  };

  const profileColors = {
    primaryColor: (profile as any).documentPrimaryColor || "#2563EB",
    secondaryColor: (profile as any).documentSecondaryColor || "#675CF1",
    logoUrl: profile.logoUrl || undefined,
    footerPrefs: {
      text: (profile as any).documentFooterText || profile.defaultFooter || undefined,
      showGeneratedBy: (profile as any).showGeneratedBy ?? true,
      showDocumentCode: (profile as any).showDocumentCode ?? true,
      showIssuedAt: (profile as any).showIssuedAt ?? true,
      showPageNumber: (profile as any).showPageNumber ?? true,
    } as FooterPrefs,
  };

  let result: RenderedDocument;

  switch (template.slug) {
    case "contrato-terapeutico":
      result = renderContratoTerapeutico(header, patient, formData, today, documentId);
      break;
    case "termo-consentimento":
      result = renderTermoConsentimento(header, patient, formData, today, documentId);
      break;
    case "termo-atendimento-online":
      result = renderTermoOnline(header, patient, formData, today, documentId);
      break;
    case "autorizacao-menor":
      result = renderAutorizacaoMenor(header, patient, formData, today, documentId);
      break;
    case "declaracao-comparecimento":
      result = renderDeclaracaoComparecimento(header, patient, formData, today, documentId);
      break;
    case "recibo-pagamento":
      result = renderReciboPagamento(header, patient, formData, today, documentId);
      break;
    default:
      result = {
        title: template.name,
        type: template.type,
        slug: template.slug,
        professionalHeader: header,
        infoBlock: { rows: [{ label: "Paciente", value: patient.fullName }] },
        sections: [{ title: "Conteúdo", content: `Documento: ${template.name}` }],
        signatureBlock: { professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o)" }, patient: { name: patient.fullName, role: "Paciente" }, city: header.city, state: header.state, date: today },
        notice: NOTICE,
        issueDate: today,
        documentId,
      };
  }

  return { ...result, ...profileColors };
}

function renderContratoTerapeutico(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const sessionValue = formatCurrency(formData["sessionValue"] as number);
  const sessionValueWords = numberToWords(formData["sessionValue"] as number);
  const sessionDuration = getField(formData, "sessionDuration", "50");
  const modality = modalityLabel(getField(formData, "modality", "presencial"));
  const paymentMethod = getField(formData, "paymentMethod", "___");
  const cancellationPolicy = getField(formData, "cancellationPolicy", "___");
  const minCancellationTime = getField(formData, "minCancellationTime", "24");
  const communicationChannel = getField(formData, "communicationChannel", "WhatsApp");
  const observations = getField(formData, "observations", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Paciente", value: patient.fullName },
      ...(patient.cpf ? [{ label: "CPF do paciente", value: patient.cpf }] : []),
      ...(patient.birthDate ? [{ label: "Data de nascimento", value: formatDate(patient.birthDate) }] : []),
      { label: "Profissional responsável", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Data de emissão", value: today },
    ],
  };

  const sections: DocumentSection[] = [
    {
      title: "1. IDENTIFICAÇÃO DAS PARTES",
      content: `CONTRATADA (PROFISSIONAL):
${header.fullName}, psicóloga(o) registrada(o) no Conselho Regional de Psicologia sob o número CRP ${header.crp}${header.clinicName ? `, atuando no ${header.clinicName}` : ""}${header.city ? `, situada(o) em ${header.city}/${header.state}` : ""}.

CONTRATANTE (PACIENTE):
${patient.fullName}${patient.cpf ? `, portador(a) do CPF nº ${patient.cpf}` : ""}${patient.birthDate ? `, nascida(o) em ${formatDate(patient.birthDate)}` : ""}.

As partes acima qualificadas celebram o presente Contrato de Prestação de Serviços Psicológicos, de forma livre e consciente, mediante as cláusulas e condições a seguir estabelecidas.`,
    },
    {
      title: "2. OBJETO DO CONTRATO",
      content: `A CONTRATADA prestará serviços de psicoterapia individual ao CONTRATANTE, de forma ética, técnica e sigilosa, em conformidade com o Código de Ética Profissional dos Psicólogos (Resolução CFP nº 10/2005), com as Resoluções do Conselho Federal de Psicologia e com a legislação vigente.

Os atendimentos têm por finalidade o suporte psicológico, o autoconhecimento e o bem-estar emocional do CONTRATANTE, não devendo ser compreendidos como garantia de resultados específicos, cura ou qualquer promessa terapêutica definitiva.`,
    },
    {
      title: "3. MODALIDADE E FREQUÊNCIA DOS ATENDIMENTOS",
      content: `Os atendimentos serão realizados na modalidade ${modality}, com frequência e horário a serem definidos e acordados entre as partes no início do acompanhamento.

Cada sessão terá duração de ${sessionDuration} minutos. A pontualidade é importante para o bom aproveitamento do tempo terapêutico. Atrasos não prorrogam o horário da sessão, salvo acordo prévio entre as partes.`,
    },
    {
      title: "4. HONORÁRIOS E FORMA DE PAGAMENTO",
      content: `O valor acordado por sessão é de ${sessionValue} (${sessionValueWords}).

A forma de pagamento é: ${paymentMethod}.

O pagamento deverá ser realizado conforme combinado entre as partes. Eventuais reajustes de valor serão comunicados com antecedência mínima de 30 (trinta) dias.`,
      highlight: true,
    },
    {
      title: "5. CANCELAMENTOS, ATRASOS E FALTAS",
      content: `O prazo mínimo para cancelamento ou reagendamento de sessão sem cobrança é de ${minCancellationTime} horas de antecedência.

Política aplicada pelo profissional: ${cancellationPolicy}

Casos de força maior, devidamente comunicados, poderão ser avaliados pela CONTRATADA de forma individualizada. A recorrência de faltas sem justificativa poderá ser discutida no contexto terapêutico ou resultar em revisão do acordo.`,
    },
    {
      title: "6. SIGILO PROFISSIONAL",
      content: `Todo o conteúdo compartilhado nas sessões é protegido pelo sigilo profissional, conforme dispõem o Código de Ética Profissional dos Psicólogos e o artigo 9º da Lei nº 4.119/1962.

A CONTRATADA não divulgará a terceiros, sem expressa autorização do CONTRATANTE, qualquer informação obtida no contexto terapêutico, salvo nas situações previstas na cláusula seguinte.`,
    },
    {
      title: "7. LIMITES DO SIGILO PROFISSIONAL",
      content: `O sigilo profissional poderá ser relativizado exclusivamente nas seguintes situações, previstas no Código de Ética Profissional dos Psicólogos e na legislação vigente:

a) Risco iminente e grave à vida do(a) próprio(a) CONTRATANTE ou de terceiros;
b) Determinação judicial fundamentada;
c) Situações em que o próprio paciente autoriza expressamente a revelação;
d) Demais hipóteses previstas no Código de Ética Profissional dos Psicólogos.

Nessas situações, a(o) profissional buscará agir com responsabilidade ética, comunicando ao CONTRATANTE sempre que possível.`,
    },
    {
      title: "8. COMUNICAÇÃO FORA DA SESSÃO",
      content: `O canal de comunicação entre as partes é: ${communicationChannel}.

As comunicações por essa via devem ser utilizadas para assuntos administrativos (agendamentos, cancelamentos, reagendamentos). Questões terapêuticas e emocionais devem ser reservadas preferencialmente ao espaço das sessões.

A CONTRATADA não se compromete com disponibilidade de atendimento imediato fora do horário de sessões.`,
    },
    {
      title: "9. TRATAMENTO DE DADOS PESSOAIS",
      content: `Os dados pessoais do CONTRATANTE serão tratados em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), sendo utilizados exclusivamente para fins clínicos e administrativos inerentes ao serviço prestado.

O CONTRATANTE poderá, a qualquer momento, solicitar acesso, correção ou exclusão de seus dados pessoais, observados os limites éticos e legais aplicáveis ao contexto de saúde.`,
    },
    {
      title: "10. ENCERRAMENTO DO ACOMPANHAMENTO",
      content: `O encerramento do acompanhamento terapêutico poderá ser solicitado por qualquer uma das partes a qualquer momento.

Recomenda-se, sempre que possível, a realização de ao menos uma sessão de encerramento, a fim de possibilitar uma conclusão adequada do processo terapêutico. Em caso de interrupção abrupta por parte do CONTRATANTE, a(o) profissional poderá entrar em contato para verificar o bem-estar e orientar sobre eventuais encaminhamentos.`,
    },
    {
      title: "11. DISPOSIÇÕES FINAIS",
      content: `O presente contrato é firmado em caráter consensual e poderá ser revisto a qualquer momento mediante acordo entre as partes.

${observations ? `Observações adicionais registradas pela(o) profissional:\n${observations}\n\n` : ""}Este instrumento não configura relação de emprego entre as partes. Qualquer litígio oriundo deste contrato será resolvido, preferencialmente, por meio de diálogo. Na impossibilidade, as partes elegem o foro da comarca de ${header.city}/${header.state} para dirimir eventuais conflitos.`,
    },
  ];

  return {
    title: "Contrato de Prestação de Serviços Psicológicos",
    type: "Contrato Terapêutico",
    slug: "contrato-terapeutico",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o)" },
      patient: { name: patient.fullName, role: "Contratante / Paciente" },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

function renderTermoConsentimento(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const modality = modalityLabel(getField(formData, "modality", "presencial"));
  const purpose = getField(formData, "purpose", "Psicoterapia individual");
  const observations = getField(formData, "observations", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Pessoa atendida", value: patient.fullName },
      ...(patient.cpf ? [{ label: "CPF", value: patient.cpf }] : []),
      ...(patient.birthDate ? [{ label: "Data de nascimento", value: formatDate(patient.birthDate) }] : []),
      { label: "Profissional responsável", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Finalidade do atendimento", value: purpose },
      { label: "Modalidade", value: modality },
      { label: "Data de emissão", value: today },
    ],
  };

  const sections: DocumentSection[] = [
    {
      title: "1. FINALIDADE DO ATENDIMENTO",
      content: `Eu, ${patient.fullName}${patient.cpf ? `, portador(a) do CPF nº ${patient.cpf}` : ""}, declaro que fui adequadamente informada(o) sobre a natureza, os objetivos e o funcionamento do atendimento psicológico que iniciarei com ${header.fullName} (CRP ${header.crp}).

A finalidade do atendimento é: ${purpose}, realizado na modalidade ${modality}.

Compreendo que a psicoterapia é um processo colaborativo, que demanda comprometimento e participação ativa, e que seus benefícios dependem de múltiplos fatores individuais e contextuais, não sendo possível garantir resultados específicos.`,
    },
    {
      title: "2. NATUREZA DO SERVIÇO PSICOLÓGICO",
      content: `Fui informada(o) de que o atendimento psicológico:

a) Baseia-se em abordagem(ns) teórica(s) e técnica(s) reconhecidas pelo Conselho Federal de Psicologia;
b) É fundamentado em escuta ativa, reflexão e construção conjunta de estratégias de bem-estar emocional;
c) Não se destina ao diagnóstico de doenças, à prescrição de medicamentos ou à substituição de atendimento médico, psiquiátrico ou de outras especialidades de saúde;
d) Pode ser combinado com outros tratamentos de saúde, quando clinicamente indicado.`,
    },
    {
      title: "3. SIGILO PROFISSIONAL",
      content: `Fui informada(o) de que todas as informações compartilhadas nas sessões são protegidas pelo sigilo profissional, garantido pelo Código de Ética Profissional dos Psicólogos (Resolução CFP nº 10/2005) e pelo artigo 9º da Lei nº 4.119/1962.

Nenhuma informação sobre meu atendimento será revelada a terceiros — incluindo familiares, empregadores, instituições ou qualquer outra pessoa — sem meu expresso consentimento prévio, salvo nas situações excepcionais previstas na cláusula seguinte.`,
    },
    {
      title: "4. LIMITES DO SIGILO PROFISSIONAL",
      content: `O sigilo poderá ser excepcionalmente relativizado, sempre com o mínimo necessário e com responsabilidade ética, nos seguintes casos:

a) Risco iminente e grave à minha vida ou à vida de terceiros;
b) Determinação judicial devidamente fundamentada;
c) Situações em que eu própria(o) autorize a revelação, de forma consciente e voluntária;
d) Demais hipóteses previstas no Código de Ética Profissional dos Psicólogos.

Fui informada(o) de que, sempre que possível, a(o) profissional comunicará previamente sobre a necessidade de quebra de sigilo.`,
      highlight: true,
    },
    {
      title: "5. REGISTROS, DOCUMENTOS E PRONTUÁRIO",
      content: `Compreendo que a(o) profissional poderá manter registros clínicos e administrativos sobre meu atendimento (prontuário psicológico), em conformidade com as normas do CFP (Resolução CFP nº 01/2009).

Esses registros são sigilosos, de uso clínico exclusivo, e serão mantidos com segurança pelo tempo determinado pelas normas éticas e legais aplicáveis. Poderei solicitar acesso ao meu prontuário, observados os limites éticos profissionais.`,
    },
    {
      title: "6. TRATAMENTO DE DADOS PESSOAIS (LGPD)",
      content: `Meus dados pessoais serão tratados em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), com as seguintes finalidades:

a) Organização e gestão do atendimento clínico;
b) Elaboração de documentos administrativos e clínicos necessários ao serviço;
c) Comunicação entre as partes (agendamentos, cancelamentos, etc.);
d) Cumprimento de obrigações éticas e legais da(o) profissional.

Meus dados não serão compartilhados com terceiros, vendidos ou utilizados para fins comerciais.`,
    },
    {
      title: "7. DIREITOS DA PESSOA ATENDIDA",
      content: `Fui informada(o) de que tenho direito a:

a) Receber informações claras sobre meu processo terapêutico e sobre as abordagens utilizadas;
b) Interromper meu atendimento a qualquer momento, sem necessidade de justificativa;
c) Ser tratada(o) com dignidade, respeito e sem qualquer forma de discriminação;
d) Solicitar informações sobre meus dados pessoais, inclusive correção e exclusão, nos termos da LGPD;
e) Registrar denúncias junto ao Conselho Regional de Psicologia, em caso de violação ética.`,
    },
    {
      title: "8. CONSENTIMENTO LIVRE E INFORMADO",
      content: `Declaro que:

a) Li e compreendi integralmente este Termo de Consentimento Livre e Informado;
b) Tive a oportunidade de esclarecer todas as minhas dúvidas com a(o) profissional antes de assinar;
c) Manifesto minha concordância de forma livre, voluntária e sem qualquer tipo de coação;
d) Estou ciente de que posso revogar este consentimento a qualquer momento, sem penalidades, e que isso não prejudicará meu atendimento.

${observations ? `Observações registradas: ${observations}\n` : ""}`,
    },
  ];

  return {
    title: "Termo de Consentimento Livre e Informado para Atendimento Psicológico",
    type: "Termo de Consentimento",
    slug: "termo-consentimento",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o) Responsável" },
      patient: { name: patient.fullName, role: "Pessoa Atendida" },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

function renderTermoOnline(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const platform = getField(formData, "platform", "___");
  const backupChannel = getField(formData, "backupChannel", "telefone");
  const observations = getField(formData, "observations", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Pessoa atendida", value: patient.fullName },
      ...(patient.cpf ? [{ label: "CPF", value: patient.cpf }] : []),
      { label: "Profissional responsável", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Plataforma de atendimento", value: platform },
      { label: "Canal alternativo", value: backupChannel },
      { label: "Data de emissão", value: today },
    ],
  };

  const sections: DocumentSection[] = [
    {
      title: "1. MODALIDADE DE ATENDIMENTO ONLINE",
      content: `Eu, ${patient.fullName}${patient.cpf ? `, portador(a) do CPF nº ${patient.cpf}` : ""}, declaro que estou ciente e de acordo com a realização de atendimento psicológico na modalidade online (telepresencial), em conformidade com as resoluções do Conselho Federal de Psicologia que regulamentam o exercício profissional remoto da Psicologia no Brasil.

Compreendo que o atendimento online é uma modalidade reconhecida ética e tecnicamente pelo CFP, e que sua efetividade é equivalente ao atendimento presencial quando realizadas as condições adequadas.`,
    },
    {
      title: "2. PLATAFORMA UTILIZADA",
      content: `Os atendimentos serão realizados por meio da plataforma: ${platform}.

Declaro que tenho acesso a essa plataforma e que, em caso de dificuldades técnicas de minha parte, entrarei em contato com a(o) profissional com a maior brevidade possível.

A(O) profissional poderá indicar outras plataformas de comunicação segura, sempre que necessário, priorizando a confidencialidade das sessões.`,
    },
    {
      title: "3. RESPONSABILIDADES TÉCNICAS E AMBIENTAIS",
      content: `Comprometo-me a:

a) Dispor de conexão de internet estável e adequada para a realização das sessões por videoconferência;
b) Utilizar um ambiente privado, silencioso e sem interrupções durante todo o período da sessão;
c) Garantir que nenhuma outra pessoa possa ouvir ou visualizar o conteúdo da sessão;
d) Ter o equipamento (computador, tablet ou celular) carregado e funcionando antes do horário agendado;
e) Não me locomover ou realizar outras atividades durante as sessões.`,
    },
    {
      title: "4. CANAL ALTERNATIVO EM CASO DE FALHA DE CONEXÃO",
      content: `Em caso de falha de conexão, queda de energia ou indisponibilidade da plataforma, o canal alternativo acordado é: ${backupChannel}.

Nesses casos, as partes aguardarão até 10 (dez) minutos para restabelecimento da conexão. Não sendo possível retomá-la, a sessão poderá ser reagendada sem cobrança adicional, a critério da(o) profissional.`,
    },
    {
      title: "5. CONFIDENCIALIDADE E PROIBIÇÃO DE GRAVAÇÃO",
      content: `Declaro que estou ciente e concordo que:

a) É expressamente proibido gravar, fotografar, transmitir ou compartilhar o conteúdo das sessões sem autorização prévia e por escrito da(o) profissional;
b) A(O) profissional também não realizará gravações das sessões sem meu consentimento expresso;
c) Mensagens e conteúdos trocados fora da sessão (por WhatsApp, e-mail ou outros meios) são igualmente sigilosos e não devem ser divulgados;
d) A violação dessas disposições poderá ensejar responsabilidade civil e/ou penal, além de configurar infração ética.`,
      highlight: true,
    },
    {
      title: "6. SITUAÇÕES DE URGÊNCIA E EMERGÊNCIA",
      content: `Estou ciente de que, em situações de crise emocional grave, risco à minha vida ou à de terceiros, devo:

a) Acionar o SAMU (192) ou o Bombeiros (193) imediatamente;
b) Contatar o Centro de Valorização da Vida — CVV (188), disponível 24 horas;
c) Dirigir-me à Unidade de Pronto Atendimento (UPA) ou ao serviço de emergência mais próximo;
d) Contatar um familiar ou pessoa de confiança.

A(O) profissional não presta atendimento de emergência remoto fora dos horários agendados.`,
    },
    {
      title: "7. SIGILO PROFISSIONAL",
      content: `O atendimento online está sujeito às mesmas garantias de sigilo profissional aplicáveis ao atendimento presencial, conforme o Código de Ética Profissional dos Psicólogos (Resolução CFP nº 10/2005).

Todos os dados pessoais e as informações compartilhadas nas sessões são tratados com absoluta confidencialidade e em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).`,
    },
    {
      title: "8. CONSENTIMENTO",
      content: `Declaro que li, compreendi e aceito integralmente as condições descritas neste Termo de Ciência e Consentimento para Atendimento Psicológico Online.

Manifesto minha concordância de forma livre, voluntária e sem qualquer tipo de coação.

${observations ? `Observações: ${observations}\n` : ""}`,
    },
  ];

  return {
    title: "Termo de Ciência e Consentimento para Atendimento Psicológico Online",
    type: "Atendimento Online",
    slug: "termo-atendimento-online",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o) Responsável" },
      patient: { name: patient.fullName, role: "Pessoa Atendida" },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

function renderAutorizacaoMenor(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const minorName = getField(formData, "minorName", patient.fullName);
  const minorBirth = formatDate(getField(formData, "minorBirthDate") || patient.birthDate);
  const minorCpf = formData["minorCpf"] ? String(formData["minorCpf"]) : patient.cpf || undefined;
  const guardianName = getField(formData, "guardianName", patient.legalGuardianName || "___");
  const guardianCpf = formData["guardianCpf"] ? String(formData["guardianCpf"]) : patient.legalGuardianCpf || undefined;
  const relationship = getField(formData, "relationship", "responsável legal");
  const modality = modalityLabel(getField(formData, "modality", "presencial"));
  const observations = getField(formData, "observations", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Criança / Adolescente", value: minorName },
      ...(minorCpf ? [{ label: "CPF do(a) menor", value: minorCpf }] : []),
      ...(minorBirth !== "__/__/____" ? [{ label: "Data de nascimento", value: minorBirth }] : []),
      { label: "Responsável legal", value: guardianName },
      ...(guardianCpf ? [{ label: "CPF do responsável", value: guardianCpf }] : []),
      { label: "Grau de parentesco / vínculo", value: relationship },
      { label: "Profissional responsável", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Modalidade", value: modality },
      { label: "Data de emissão", value: today },
    ],
  };

  const sections: DocumentSection[] = [
    {
      title: "1. IDENTIFICAÇÃO DO(A) RESPONSÁVEL LEGAL",
      content: `Eu, ${guardianName}${guardianCpf ? `, portador(a) do CPF nº ${guardianCpf}` : ""}, na qualidade de ${relationship} do(a) menor ${minorName}${minorCpf ? `, portador(a) do CPF nº ${minorCpf}` : ""}${minorBirth !== "__/__/____" ? `, nascido(a) em ${minorBirth}` : ""}, declaro que tenho plena capacidade civil e legal para autorizar o atendimento psicológico descrito neste documento.`,
    },
    {
      title: "2. AUTORIZAÇÃO EXPRESSA PARA ATENDIMENTO",
      content: `AUTORIZO expressamente a(o) psicóloga(o) ${header.fullName}, registrada(o) no Conselho Regional de Psicologia sob o número CRP ${header.crp}${header.clinicName ? `, atuando no ${header.clinicName}` : ""}, a realizar atendimento psicológico individual com o(a) menor sob minha responsabilidade, na modalidade ${modality}.

Estou ciente de que o atendimento é de natureza clínica, voltado ao desenvolvimento emocional, à saúde mental e ao bem-estar da criança ou adolescente, e que será conduzido com base em abordagem(ns) reconhecida(s) pelo Conselho Federal de Psicologia.`,
    },
    {
      title: "3. CIÊNCIA SOBRE A NATUREZA DO ATENDIMENTO PSICOLÓGICO",
      content: `Compreendo que:

a) O atendimento psicológico de crianças e adolescentes é regulamentado pelo Conselho Federal de Psicologia, pelo Estatuto da Criança e do Adolescente (ECA — Lei nº 8.069/1990) e pelo Código de Ética Profissional dos Psicólogos;
b) A(O) profissional irá conduzir o atendimento com base no melhor interesse do(a) menor, respeitando sua fase de desenvolvimento e suas necessidades específicas;
c) O processo terapêutico pode envolver técnicas lúdicas, expressivas e verbais, adaptadas à faixa etária;
d) O atendimento não configura garantia de resultados específicos, tampouco diagnóstico, laudo ou parecer.`,
    },
    {
      title: "4. SIGILO PROFISSIONAL E COMUNICAÇÃO COM RESPONSÁVEIS",
      content: `Compreendo e aceito que:

a) As informações compartilhadas pelo(a) menor nas sessões são protegidas pelo sigilo profissional;
b) A(O) profissional poderá comunicar ao(à) responsável informações gerais sobre o andamento do processo, sem revelar o conteúdo sigiloso das sessões, sempre no melhor interesse do(a) menor;
c) Em situações de risco à integridade física ou psicológica do(a) menor ou de terceiros, o sigilo poderá ser relativizado, conforme prevê o Código de Ética Profissional dos Psicólogos e o ECA;
d) Reconheço que o sigilo é um direito do(a) menor e que sua proteção contribui para a efetividade do processo terapêutico.`,
      highlight: true,
    },
    {
      title: "5. TRATAMENTO DE DADOS PESSOAIS",
      content: `Os dados pessoais do(a) menor e do(a) responsável legal serão tratados em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), sendo utilizados exclusivamente para fins clínicos e administrativos relacionados ao atendimento.

Não haverá compartilhamento de dados com terceiros sem autorização expressa do(a) responsável legal, salvo nas hipóteses legalmente previstas.`,
    },
    {
      title: "6. DISPOSIÇÕES FINAIS",
      content: `Declaro que:

a) Li e compreendi integralmente este documento;
b) Tive a oportunidade de esclarecer todas as minhas dúvidas com a(o) profissional;
c) Manifesto minha autorização de forma livre, voluntária e consciente.

${observations ? `Observações adicionais: ${observations}\n` : ""}`,
    },
  ];

  return {
    title: "Autorização para Atendimento Psicológico de Criança ou Adolescente",
    type: "Autorização",
    slug: "autorizacao-menor",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o) Responsável" },
      guardian: { name: guardianName, role: `${relationship} do(a) menor ${minorName}` },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

function renderDeclaracaoComparecimento(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const sessionDate = formatDate(getField(formData, "sessionDate"));
  const startTime = getField(formData, "startTime", "___:___");
  const endTime = getField(formData, "endTime", "___:___");
  const modality = modalityLabel(getField(formData, "modality", "presencial"));
  const purpose = getField(formData, "purpose", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Nome completo", value: patient.fullName },
      ...(patient.cpf ? [{ label: "CPF", value: patient.cpf }] : []),
      { label: "Data da sessão", value: sessionDate },
      { label: "Horário", value: `${startTime} às ${endTime}` },
      { label: "Modalidade", value: modality },
      { label: "Profissional responsável", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Data de emissão", value: today },
    ],
  };

  const declarationText = `Declaro, para os devidos fins e a quem possa interessar, que ${patient.fullName}${patient.cpf ? `, portador(a) do CPF nº ${patient.cpf}` : ""}, compareceu a atendimento psicológico realizado sob minha responsabilidade profissional, conforme os dados abaixo:

Data da sessão: ${sessionDate}
Horário de início: ${startTime}
Horário de término: ${endTime}
Modalidade: ${modality}${purpose ? `\nFinalidade informada: ${purpose}` : ""}

O presente atendimento foi realizado em conformidade com o Código de Ética Profissional dos Psicólogos e com as normas do Conselho Federal de Psicologia.

Esta declaração é emitida por solicitação da(o) própria(o) paciente, para fins exclusivamente comprobatórios de comparecimento, não contendo qualquer informação de natureza clínica, diagnóstica ou terapêutica, em respeito ao sigilo profissional garantido pela legislação vigente.

Por ser verdade, firmo a presente declaração.`;

  const sections: DocumentSection[] = [
    {
      title: "DECLARAÇÃO",
      content: declarationText,
    },
  ];

  return {
    title: "Declaração de Comparecimento",
    type: "Declaração",
    slug: "declaracao-comparecimento",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o)" },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

function renderReciboPagamento(
  header: ProfessionalHeader,
  patient: Patient,
  formData: Record<string, unknown>,
  today: string,
  documentId?: string,
): RenderedDocument {
  const amount = formatCurrency(formData["amount"] as number);
  const amountWords = numberToWords(formData["amount"] as number);
  const paymentDate = formatDate(getField(formData, "paymentDate"));
  const paymentMethod = getField(formData, "paymentMethod", "___");
  const reference = getField(formData, "reference", "Sessão de psicoterapia");
  const payerDocument = getField(formData, "payerDocument", "");

  const infoBlock: InfoBlock = {
    rows: [
      { label: "Valor recebido", value: amount },
      { label: "Valor por extenso", value: amountWords },
      { label: "Pagador(a)", value: patient.fullName },
      ...(patient.cpf || payerDocument ? [{ label: "CPF do pagador", value: patient.cpf || payerDocument }] : []),
      { label: "Referência", value: reference },
      { label: "Forma de pagamento", value: paymentMethod },
      { label: "Data do pagamento", value: paymentDate },
      { label: "Recebido por", value: header.fullName },
      { label: "CRP", value: header.crp },
      { label: "Data de emissão", value: today },
    ],
  };

  const sections: DocumentSection[] = [
    {
      title: "RECIBO",
      content: `Recebi de ${patient.fullName}${patient.cpf ? `, portador(a) do CPF nº ${patient.cpf}` : ""}${payerDocument && !patient.cpf ? `, CPF/CNPJ nº ${payerDocument}` : ""}

a importância de ${amount}
(${amountWords})

referente a: ${reference}.`,
      highlight: true,
    },
    {
      title: "DETALHES DO PAGAMENTO",
      content: `Data do pagamento: ${paymentDate}
Forma de pagamento: ${paymentMethod}${header.clinicName ? `\nEstabelecimento: ${header.clinicName}` : ""}

Profissional responsável pelo serviço:
${header.fullName}
Psicóloga(o) — CRP ${header.crp}${header.city ? `\n${header.city}/${header.state}` : ""}`,
    },
    {
      title: "DECLARAÇÃO",
      content: `Declaro que recebi a importância acima discriminada, relativa aos serviços psicológicos prestados, dando plena, geral e irrevogável quitação pelo valor recebido.

Por ser expressão da verdade, firmo o presente recibo.`,
    },
  ];

  return {
    title: "Recibo de Pagamento",
    type: "Recibo",
    slug: "recibo-pagamento",
    professionalHeader: header,
    infoBlock,
    sections,
    signatureBlock: {
      professional: { name: header.fullName, crp: header.crp, role: "Psicóloga(o) — Prestador(a) de Serviço" },
      city: header.city,
      state: header.state,
      date: today,
    },
    notice: NOTICE,
    issueDate: today,
    documentId,
  };
}

export function renderDocumentWithMockData(slug: string): RenderedDocument | null {
  const MOCK_TODAY = "02/05/2026";

  const mockHeader: ProfessionalHeader = {
    fullName: "Ana Lima",
    crp: "06/123456",
    clinicName: "Consultório Ana Lima",
    email: "demo@psidocs.com",
    phone: "(11) 99999-0000",
    city: "São Paulo",
    state: "SP",
  };

  const mockPatient = {
    fullName: "Mariana Souza",
    cpf: "123.456.789-00",
    birthDate: "1990-05-15",
    legalGuardianName: "Carla Souza",
    legalGuardianCpf: "987.654.321-00",
  } as unknown as Patient;

  const MOCK_EXTRAS = {
    primaryColor: "#2563EB",
    secondaryColor: "#675CF1",
    footerPrefs: {
      showGeneratedBy: true,
      showDocumentCode: false,
      showIssuedAt: true,
      showPageNumber: false,
    } satisfies FooterPrefs,
  };

  let result: RenderedDocument;

  switch (slug) {
    case "contrato-terapeutico": {
      result = renderContratoTerapeutico(mockHeader, mockPatient, {
        sessionValue: 180,
        sessionDuration: "50",
        modality: "online",
        paymentMethod: "Pix",
        cancellationPolicy: "Sessões canceladas com menos de 24h de antecedência serão cobradas integralmente.",
        minCancellationTime: "24",
        communicationChannel: "WhatsApp",
      }, MOCK_TODAY);
      break;
    }
    case "termo-consentimento": {
      result = renderTermoConsentimento(mockHeader, mockPatient, {
        modality: "online",
        purpose: "Psicoterapia individual",
      }, MOCK_TODAY);
      break;
    }
    case "termo-atendimento-online": {
      result = renderTermoOnline(mockHeader, mockPatient, {
        platform: "Google Meet",
        backupChannel: "WhatsApp",
      }, MOCK_TODAY);
      break;
    }
    case "autorizacao-menor": {
      result = renderAutorizacaoMenor(mockHeader, mockPatient, {
        minorName: "Lucas Souza",
        minorBirthDate: "2014-03-10",
        guardianName: "Carla Souza",
        guardianCpf: "987.654.321-00",
        relationship: "Mãe",
        modality: "presencial",
      }, MOCK_TODAY);
      break;
    }
    case "declaracao-comparecimento": {
      result = renderDeclaracaoComparecimento(mockHeader, mockPatient, {
        sessionDate: "2026-05-02",
        startTime: "14:00",
        endTime: "14:50",
        modality: "online",
      }, MOCK_TODAY);
      break;
    }
    case "recibo-pagamento": {
      result = renderReciboPagamento(mockHeader, mockPatient, {
        amount: 180,
        paymentDate: "2026-05-02",
        paymentMethod: "Pix",
        reference: "Sessão de psicoterapia individual",
      }, MOCK_TODAY);
      break;
    }
    default:
      return null;
  }

  return { ...result, ...MOCK_EXTRAS };
}

export function renderedDocumentToPlainText(doc: RenderedDocument): string {
  const lines: string[] = [];

  lines.push(doc.title.toUpperCase());
  lines.push("");

  const h = doc.professionalHeader;
  lines.push(`${h.fullName} — CRP ${h.crp}${h.clinicName ? ` — ${h.clinicName}` : ""} — ${h.city}/${h.state}`);
  lines.push("");

  for (const row of doc.infoBlock.rows) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");

  for (const section of doc.sections) {
    lines.push(section.title);
    lines.push(section.content);
    lines.push("");
  }

  const sig = doc.signatureBlock;
  lines.push(`${sig.city}/${sig.state}, ${sig.date}`);
  lines.push("");
  lines.push(`_________________________`);
  lines.push(sig.professional.name);
  lines.push(`CRP: ${sig.professional.crp}`);
  lines.push(sig.professional.role);
  if (sig.patient) {
    lines.push("");
    lines.push(`_________________________`);
    lines.push(sig.patient.name);
    lines.push(sig.patient.role);
  }
  if (sig.guardian) {
    lines.push("");
    lines.push(`_________________________`);
    lines.push(sig.guardian.name);
    lines.push(sig.guardian.role);
  }
  lines.push("");
  lines.push(doc.notice);

  return lines.join("\n");
}
