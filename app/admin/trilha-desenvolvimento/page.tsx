'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// A gestão das Trilhas de Desenvolvimento foi unida à Central de Conhecimento.
// Esta rota antiga redireciona para a aba certa, para não quebrar links salvos.
export default function RedirecionaTrilhaDesenvolvimento() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/treinamento?aba=trilhas')
  }, [router])

  return (
    <div className="grid min-h-[40vh] place-items-center text-sm text-tinta-3">
      Redirecionando para a Central de Conhecimento…
    </div>
  )
}
