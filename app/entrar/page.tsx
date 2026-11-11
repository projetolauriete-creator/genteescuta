'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/LinkSemPrefetch'
import { ArrowLeft, LogOut } from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { observarLogin, sair } from '@/lib/fb/auth'
import { getConfig } from '@/lib/fb/publico'
import { perfilAtual } from '@/lib/fb/funcionarios'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'
import { FormEntrar } from '@/components/FormEntrar'

export default function Entrar() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')
  const [semAcesso, setSemAcesso] = useState<string | null>(null)

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
    const cancelar = observarLogin(async (user) => {
      if (!user) {
        setSemAcesso(null)
        return
      }
      const p = await perfilAtual().catch(() => null)
      if (!p || p.tipo === 'nenhum' || !p.ativo) {
        setSemAcesso(user.email ?? '')
        return
      }
      if (p.senha_provisoria) {
        router.replace('/primeiro-acesso')
        return
      }
      // Todos (inclusive admin) caem na home do portal. O Painel ADM continua
      // acessível pelo botão no topo, para quem tem permissão.
      router.replace('/')
    })
    return cancelar
  }, [router])

  if (!configurado()) return <TelaConfiguracao />

  async function fazerLogout() {
    await sair()
    setSemAcesso(null)
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="hero-acolhedor px-7 py-8 sm:px-9 sm:py-10">
          <img src="/logo-soulan.png" alt={empresa} className="h-10 w-auto" />

          {semAcesso ? (
            <>
              <h1 className="titulo-hero mt-6 text-[1.5rem] text-tinta">Conta sem acesso</h1>
              <p className="mt-2 text-sm leading-6 text-tinta-2">
                A conta <strong className="font-medium text-tinta">{semAcesso}</strong> ainda não foi liberada ou está
                inativa. Fale com a equipe de Gente &amp; Cultura para liberar o seu acesso.
              </p>
              <button
                type="button"
                onClick={fazerLogout}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta hover:bg-superficie-2"
              >
                <LogOut size={15} aria-hidden /> Sair
              </button>
            </>
          ) : (
            <>
              <h1 className="titulo-hero mt-6 text-[1.625rem] text-tinta">Entrar</h1>
              <p className="mt-2 text-sm leading-6 text-tinta-2">
                Use seu <strong className="font-semibold text-tinta">e-mail</strong> e a sua senha para acessar.
              </p>

              <div className="mt-6 rounded-2xl border border-borda bg-white/80 p-5 shadow-[0_1px_3px_rgba(26,23,20,0.05)] backdrop-blur">
                <FormEntrar />
              </div>
            </>
          )}
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-tinta-3 transition-colors hover:text-marca"
        >
          <ArrowLeft size={15} aria-hidden /> Voltar para o Gente Cultura
        </Link>
      </div>
    </main>
  )
}
