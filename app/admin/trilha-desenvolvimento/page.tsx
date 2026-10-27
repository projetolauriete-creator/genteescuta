'use client'

import { CabecalhoPagina } from '@/components/ui'
import { GestaoTrilhasDev } from '@/components/GestaoTrilhasDev'

export default function AdminTrilhaDesenvolvimento() {
  return (
    <>
      <CabecalhoPagina
        titulo="Trilha de Desenvolvimento"
        descricao="Crie trilhas gamificadas com atividades e pontos. As mudanças aparecem para os colaboradores na hora."
        voltar={{ href: '/trilhas', rotulo: 'Ver trilhas (colaborador)' }}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <GestaoTrilhasDev />
      </div>
    </>
  )
}
