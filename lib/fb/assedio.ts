'use client'

// =============================================================
// Protocolo de Prevenção e Enfrentamento ao Assédio e às Condutas
// Inadequadas.
//
// Canal RESTRITO: o relato vai para a coleção `assedio_relatos`,
// separada das manifestações comuns. As Regras do Firestore travam a
// leitura só para Gente e Cultura (papel 'gente_cultura' ou a conta
// semente); nem gestor, nem colaborador, nem a Diretoria leem, nem por
// URL direta nem pela API. O envio é sempre IDENTIFICADO (nome + centro
// de custo), para que a equipe consiga atuar e acolher a pessoa. Os
// anexos ficam na coleção `assedio_anexos`, também restrita a G&C.
// =============================================================
import { addDoc, collection, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// -------------------------------------------------------------
// Fluxo operacional em 5 passos (conteúdo informativo ao colaborador).
// -------------------------------------------------------------
export interface PassoProtocolo {
  titulo: string
  texto: string
}

export const PASSOS_PROTOCOLO: PassoProtocolo[] = [
  {
    titulo: 'Acolher',
    texto: 'Vamos ouvir você com respeito, atenção e sem julgamentos.',
  },
  {
    titulo: 'Entender o ocorrido',
    texto:
      'Analisaremos as informações compartilhadas com discrição e adotaremos as medidas necessárias para garantir a segurança.',
  },
  {
    titulo: 'Acompanhar e orientar',
    texto:
      'A equipe de Gente & Cultura avaliará o caso, orientará você sobre os próximos passos e acompanhará a situação até a conclusão das providências necessárias.',
  },
]

// -------------------------------------------------------------
// Mensagens padrão (editáveis depois no admin, em config/assedio).
// Valores iniciais usados enquanto a equipe não personaliza o texto.
// -------------------------------------------------------------
export const MENSAGENS_ASSEDIO_PADRAO = {
  acolhimento:
    'Olá! Agradecemos por compartilhar o ocorrido conosco e por confiar na Soulan. Queremos que você saiba que a sua manifestação será tratada com sigilo, respeito e cuidado. A equipe de Gente e Cultura vai acolher, apurar e dar os encaminhamentos necessários. Você não está sozinho. Conte com a Soulan. Respeito, acolhimento e segurança são prioridades para nós.',
  descontinuidade:
    'No Grupo Soulan prezamos rigorosamente pelo respeito, pela ética e pela segurança em todas as nossas relações. Diante do ocorrido, decidimos descontinuar o processo em andamento. Agradecemos a compreensão. Atenciosamente, Grupo Soulan.',
}

export type MensagensAssedio = typeof MENSAGENS_ASSEDIO_PADRAO

/** Lê as mensagens padrão (acolhimento e descontinuidade). Caem no texto
 *  inicial quando ainda não há uma versão personalizada em config/assedio. */
export async function getMensagensAssedio(): Promise<MensagensAssedio> {
  const snap = await getDoc(doc(db(), 'config', 'assedio')).catch(() => null)
  const d = (snap && snap.exists() ? snap.data() : {}) as Record<string, unknown>
  const texto = (v: unknown, padrao: string) =>
    typeof v === 'string' && v.trim() ? v : padrao
  return {
    acolhimento: texto(d.acolhimento, MENSAGENS_ASSEDIO_PADRAO.acolhimento),
    descontinuidade: texto(d.descontinuidade, MENSAGENS_ASSEDIO_PADRAO.descontinuidade),
  }
}

// -------------------------------------------------------------
// Anexo de um relato (print, PDF, foto). Guardado como data URL, sem
// Firebase Storage, no mesmo teto do resto do projeto.
// -------------------------------------------------------------
export interface AnexoRelato {
  tipo: 'imagem' | 'documento'
  nome: string
  dados: string // data URL
}

/** Quantos anexos cabem num relato (cada um já limitado a ~700 KB). */
export const MAX_ANEXOS_RELATO = 5

// -------------------------------------------------------------
// Envio do relato (sempre IDENTIFICADO: nome + centro de custo).
// Guarda nome, e-mail, centro de custo e, quando a pessoa está logada, o
// autor (uid), para que a equipe possa atuar e dar um retorno. Os anexos
// vão para `assedio_anexos`, ligados ao relato pelo id.
// -------------------------------------------------------------
export async function enviarRelatoAssedio(p: {
  nome: string
  email: string
  centro_custo: string
  relato: string
  anexos?: AnexoRelato[]
}): Promise<{ ok: true }> {
  const relato = String(p.relato ?? '').trim()
  const nome = String(p.nome ?? '').trim()
  const email = String(p.email ?? '').trim().toLowerCase()
  const centro = String(p.centro_custo ?? '').trim()
  const anexos = Array.isArray(p.anexos) ? p.anexos.slice(0, MAX_ANEXOS_RELATO) : []

  if (nome.length < 3) throw new Error('Informe o seu nome completo.')
  if (!EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido para a equipe falar com você.')
  if (!centro) throw new Error('Selecione o seu centro de custo (área).')
  if (relato.length < 10 || relato.length > 5000) {
    throw new Error('Descreva o ocorrido (de 10 a 5.000 caracteres).')
  }

  const agora = new Date().toISOString()
  const u = auth().currentUser

  const ref = await addDoc(collection(db(), 'assedio_relatos'), {
    relato,
    nome,
    email,
    centro_custo: centro,
    autor_uid: u?.uid ?? null,
    tem_anexo: anexos.length > 0,
    qtd_anexos: anexos.length,
    status: 'recebido',
    criado_em: agora,
    atualizado_em: agora,
  })

  // Anexos num doc por arquivo (não estoura o teto de ~1 MB do relato).
  for (const a of anexos) {
    await addDoc(collection(db(), 'assedio_anexos'), {
      relato_id: ref.id,
      tipo: a.tipo === 'imagem' ? 'imagem' : 'documento',
      nome: String(a.nome ?? '').slice(0, 200),
      dados: a.dados,
      criado_em: agora,
    })
  }

  return { ok: true }
}
