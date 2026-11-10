'use client'

// =============================================================
// Central de Conhecimento (admin): página única que reúne as três áreas de
// gestão em abas:
//   • documentos    → Sala de documentos por área (módulos + documentos)
//   • trilhas       → Trilhas de Desenvolvimento (gamificadas, página /trilhas)
//   • treinamentos  → Treinamentos (trilhas da Central de Conhecimento pública)
//
// A aba inicial pode vir por ?aba=... (ex.: o redirecionamento da rota antiga
// /admin/trilha-desenvolvimento manda para ?aba=trilhas).
// =============================================================
import { useEffect, useState } from 'react'
import { FolderOpen, Rocket, GraduationCap } from 'lucide-react'
import { CabecalhoPagina } from '@/components/ui'
import { GestaoDocumentos } from '@/components/GestaoDocumentos'
import { GestaoTrilhasDev } from '@/components/GestaoTrilhasDev'
import { GestaoTreinos } from '@/components/GestaoTreinos'

type AbaId = 'documentos' | 'trilhas' | 'treinamentos'

const ABAS: { id: AbaId; rotulo: string; Icone: typeof FolderOpen }[] = [
  { id: 'documentos', rotulo: 'Sala de documentos', Icone: FolderOpen },
  { id: 'trilhas', rotulo: 'Trilhas de Desenvolvimento', Icone: Rocket },
  { id: 'treinamentos', rotulo: 'Treinamentos', Icone: GraduationCap },
]

function abaValida(v: string | null): AbaId {
  return v === 'trilhas' || v === 'treinamentos' || v === 'documentos' ? v : 'documentos'
}

export default function AdminCentralConhecimento() {
  const [aba, setAba] = useState<AbaId>('documentos')

  // Lê a aba inicial da URL (?aba=...) uma vez, no cliente.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('aba')
      setAba(abaValida(p))
    } catch {
      /* mantém o padrão */
    }
  }, [])

  function trocar(novo: AbaId) {
    setAba(novo)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('aba', novo)
      window.history.replaceState(null, '', url.toString())
    } catch {
      /* sem bloquear a troca de aba */
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Central de Conhecimento"
        descricao="Tudo em um lugar: a Sala de documentos por área, as Trilhas de Desenvolvimento e os Treinamentos da página pública."
        voltar={{ href: '/treinamento', rotulo: 'Ver página pública' }}
      />

      <div className="max-w-4xl p-4 sm:p-6">
        {/* Abas */}
        <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-borda pb-px" role="tablist" aria-label="Áreas de gestão">
          {ABAS.map(({ id, rotulo, Icone }) => {
            const ativa = aba === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => trocar(id)}
                className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  ativa
                    ? 'border-marca text-marca-texto'
                    : 'border-transparent text-tinta-3 hover:text-tinta'
                }`}
              >
                <Icone size={16} aria-hidden /> {rotulo}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div className="mt-5">
          {aba === 'documentos' && <GestaoDocumentos embutido />}
          {aba === 'trilhas' && (
            <div>
              <div className="mb-4">
                <h2 className="titulo-secao text-tinta">Trilhas de Desenvolvimento</h2>
                <p className="mt-1 max-w-2xl text-sm text-tinta-2">
                  Trilhas gamificadas com atividades e pontos (página pública de Trilhas). As mudanças aparecem para os colaboradores na hora.
                </p>
              </div>
              <GestaoTrilhasDev />
            </div>
          )}
          {aba === 'treinamentos' && <GestaoTreinos />}
        </div>
      </div>
    </>
  )
}
