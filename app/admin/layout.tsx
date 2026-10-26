'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from '@/components/LinkSemPrefetch'
import { LogOut, ExternalLink, Menu, X } from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { observarLogin, sair, type User } from '@/lib/fb/auth'
import { getConfig } from '@/lib/fb/publico'
import { listarManifestacoes } from '@/lib/fb/admin'
import { minhaConta, definirNovaSenhaInicial, diagnosticoAcesso, type Conta, type DiagnosticoAcesso } from '@/lib/fb/usuarios'
import { PERFIL_POR_ID } from '@/lib/permissoes'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'
import { NavAdmin } from '@/components/NavAdmin'

// Badge do menu = manifestações ainda NÃO analisadas (não vistas).
function contarNaoVistas(ms: any[]): number {
  return ms.filter((m) => (m.analise ?? 'nao_analisada') !== 'analisada').length
}

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const caminho = usePathname()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [conta, setConta] = useState<Conta | null | undefined>(undefined)
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')
  const [pendentes, setPendentes] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)

  const atualizarPendentes = useCallback(() => {
    listarManifestacoes().then((ms) => setPendentes(contarNaoVistas(ms))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!configurado()) return
    const cancelar = observarLogin(async (u) => {
      setUser(u)
      if (!u) {
        router.replace('/entrar')
        return
      }
      getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
      const c = await minhaConta().catch(() => null)
      setConta(c)
      if (c && c.ativo) atualizarPendentes()
    })
    return cancelar
  }, [router, atualizarPendentes])

  // Atualiza o badge sozinho: ao navegar, ao voltar o foco, e quando a moderação
  // avisa que algo mudou (manifestação vista/respondida/concluída).
  useEffect(() => {
    if (!conta || !conta.ativo) return
    atualizarPendentes()
    const aoFocar = () => atualizarPendentes()
    const aoMudar = () => atualizarPendentes()
    window.addEventListener('focus', aoFocar)
    window.addEventListener('manifestacoes:mudou', aoMudar)
    return () => {
      window.removeEventListener('focus', aoFocar)
      window.removeEventListener('manifestacoes:mudou', aoMudar)
    }
  }, [caminho, conta, atualizarPendentes])

  if (!configurado()) return <TelaConfiguracao />

  if (user === undefined || user === null || conta === undefined) {
    return <div className="grid min-h-screen place-items-center text-sm text-tinta-3">Carregando…</div>
  }

  async function fazerLogout() {
    await sair()
    router.replace('/entrar')
  }

  if (!conta || !conta.ativo) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="cartao-g max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-tinta">Acesso indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-tinta-2">
            A conta <strong className="font-medium text-tinta">{user.email}</strong> está inativa ou ainda não tem
            permissão de acesso. Fale com um administrador para liberar.
          </p>
          <DiagnosticoBox />
          <button
            type="button"
            onClick={fazerLogout}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta hover:bg-superficie-2"
          >
            <LogOut size={15} aria-hidden /> Sair
          </button>
        </div>
      </div>
    )
  }

  if (conta.senha_provisoria) {
    return (
      <TrocaSenhaInicial
        email={conta.email}
        aoConcluir={async () => setConta(await minhaConta().catch(() => conta))}
        aoSair={fazerLogout}
      />
    )
  }

  const souSuper = conta.nivel === 'super'
  const nivelLabel =
    conta.nivel === 'super' ? 'Super Admin'
      : conta.nivel === 'master' ? 'Master'
        : PERFIL_POR_ID[conta.perfil]?.nome ?? '-'

  return (
    <div className="min-h-screen bg-plano lg:flex">
      {/* Barra superior (só no celular) */}
      <header className="sem-impressao sticky top-0 z-30 flex items-center gap-3 border-b border-borda bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 text-tinta-2 hover:bg-superficie-2"
        >
          <Menu size={22} aria-hidden />
        </button>
        <Link
          href="/"
          title="Ir para a página inicial do site"
          className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
        >
          <img src="/simbolo-soulan.png" alt="Soulan" className="h-7 w-7 flex-none object-contain" />
          <span className="text-[0.9375rem] font-[620] tracking-[-0.018em] text-tinta">Gente Cultura</span>
        </Link>
      </header>

      {/* Sombra por trás do menu no celular */}
      {menuAberto && (
        <div
          className="sem-impressao fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      {/* Menu lateral (fixo no desktop, gaveta no celular) */}
      <aside
        className={`sem-impressao fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-borda bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:flex-none lg:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-borda px-4 py-4">
          <Link
            href="/"
            onClick={() => setMenuAberto(false)}
            title="Ir para a página inicial do site"
            className="flex min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
          >
            <img src="/simbolo-soulan.png" alt="Soulan" className="h-8 w-8 flex-none object-contain" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.9375rem] font-[620] tracking-[-0.018em] text-tinta">Gente Cultura</span>
              <span className="block truncate text-xs text-tinta-3">{empresa}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
            className="ml-auto rounded-lg p-1.5 text-tinta-3 hover:bg-superficie-2 lg:hidden"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="fio-marca mx-4 my-3" aria-hidden />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavAdmin pendentes={pendentes} souSuper={souSuper} permissoes={conta.permissoes} aoNavegar={() => setMenuAberto(false)} />
        </div>

        <div className="border-t border-borda px-4 py-3">
          <Link
            href="/"
            target="_blank"
            className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-tinta-3 transition-colors hover:text-marca"
          >
            <ExternalLink size={13} aria-hidden /> Ver site público
          </Link>
          <p className="truncate text-xs font-medium text-tinta-2">{conta.email}</p>
          <p className="text-[11px] text-tinta-3">{nivelLabel}</p>
          <button
            type="button"
            onClick={fazerLogout}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tinta-3 transition-colors hover:text-critico"
          >
            <LogOut size={13} aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Diagnóstico técnico (temporário) para entender por que o acesso foi barrado.
function DiagnosticoBox() {
  const [d, setD] = useState<DiagnosticoAcesso | null | undefined>(undefined)
  useEffect(() => { diagnosticoAcesso().then(setD).catch(() => setD(null)) }, [])
  if (d === undefined || d === null) return null
  const linha = (rot: string, val: string) => (
    <div className="flex justify-between gap-3"><span className="text-tinta-3">{rot}</span><span className="font-medium text-tinta">{val}</span></div>
  )
  return (
    <div className="mt-4 rounded-lg border border-borda bg-superficie-2 p-3 text-left text-xs">
      <p className="mb-1.5 font-semibold text-tinta-2">Diagnóstico de acesso (envie este print ao suporte)</p>
      <div className="space-y-1">
        {linha('Cadastro de funcionário encontrado', d.func_existe ? 'Sim' : 'Não')}
        {linha('Ativo', d.func_ativo === null ? '—' : d.func_ativo ? 'Sim' : 'Não')}
        {linha('Papéis', d.papeis.length ? d.papeis.join(', ') : '(nenhum)')}
        {linha('Perfil', d.perfil ?? '(nenhum)')}
        {linha('Permissões de painel', d.tem_permissoes ? 'Sim' : 'Não')}
      </div>
    </div>
  )
}

function TrocaSenhaInicial({
  email,
  aoConcluir,
  aoSair,
}: {
  email: string
  aoConcluir: () => void
  aoSair: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const f = new FormData(e.currentTarget)
    const nova = String(f.get('nova') ?? '')
    const conf = String(f.get('conf') ?? '')
    if (nova !== conf) return setErro('As duas senhas não são iguais.')
    setPendente(true)
    try {
      await definirNovaSenhaInicial(nova)
      aoConcluir()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui trocar a senha.')
      setPendente(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center gap-2.5">
          <img src="/simbolo-soulan.png" alt="Soulan" className="h-9 w-9 object-contain" />
          <span className="text-base font-semibold text-tinta">Gente Cultura</span>
        </div>
        <div className="cartao-g p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-tinta">Bem-vindo(a)! Crie a sua senha</h1>
          <p className="mt-1.5 text-sm leading-6 text-tinta-2">
            Este é o seu primeiro acesso com <strong className="font-medium text-tinta">{email}</strong>. Defina uma
            senha nova para continuar.
          </p>
          <form onSubmit={enviar} className="mt-5 space-y-4">
            {erro && (
              <p className="rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3.5 py-2.5 text-sm text-[#8a1f1f]">{erro}</p>
            )}
            <label className="block">
              <span className="block text-sm font-medium text-tinta">Nova senha</span>
              <span className="mt-0.5 block text-xs text-tinta-3">Mínimo 8 caracteres, diferente da padrão.</span>
              <input
                name="nova"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 block w-full rounded-lg border border-borda-forte bg-white px-3.5 py-2.5 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-tinta">Repita a nova senha</span>
              <input
                name="conf"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 block w-full rounded-lg border border-borda-forte bg-white px-3.5 py-2.5 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
              />
            </label>
            <button
              type="submit"
              disabled={pendente}
              className="botao-gradiente inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {pendente ? 'Salvando…' : 'Criar senha e entrar'}
            </button>
          </form>
        </div>
        <button type="button" onClick={aoSair} className="mt-4 block w-full text-center text-sm text-tinta-3 hover:text-marca">
          Sair
        </button>
      </div>
    </div>
  )
}
