'use client'

import { useEffect, useState } from 'react'
import { Save, Plus, KeyRound } from 'lucide-react'
import { salvarConfig, adicionarArea } from '@/lib/fb/admin'
import { getTaxaKm, salvarTaxaKm } from '@/lib/fb/reembolso'
import { TAXA_KM_PADRAO } from '@/lib/reembolso'
import { trocarSenha } from '@/lib/fb/auth'
import { Aviso, Botao, Campo, ENTRADA } from '@/components/ui'

export function FormReembolsoConfig() {
  const [taxa, setTaxa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pendente, setPendente] = useState(false)

  useEffect(() => {
    getTaxaKm()
      .then((t) => setTaxa(String(t).replace('.', ',')))
      .catch(() => setTaxa(String(TAXA_KM_PADRAO).replace('.', ',')))
      .finally(() => setCarregando(false))
  }, [])

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setOk(false)
    const t = Number(String(taxa).replace(/\./g, '').replace(',', '.'))
    if (!(t > 0)) return setErro('Informe uma taxa por km maior que zero.')
    setPendente(true)
    try {
      await salvarTaxaKm(t)
      setOk(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui salvar.')
    }
    setPendente(false)
  }

  if (carregando) return <p className="text-sm text-tinta-3">Carregando…</p>

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && <Aviso tom="sucesso">Taxa de KM salva.</Aviso>}
      <Campo rotulo="Valor por km (R$)" ajuda="Usado no cálculo automático das despesas de KM: km x esta taxa. Vale para as novas solicitações.">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-tinta-3">R$</span>
          <input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="1,20" className={`${ENTRADA} max-w-[8rem]`} />
          <span className="text-sm text-tinta-3">por km</span>
        </div>
      </Campo>
      <Botao type="submit" disabled={pendente}><Save size={15} aria-hidden /> {pendente ? 'Salvando…' : 'Salvar'}</Botao>
    </form>
  )
}

export function FormEmpresa({ config }: { config: any }) {
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pendente, setPendente] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setOk(false); setPendente(true)
    const f = new FormData(e.currentTarget)
    try {
      await salvarConfig({
        empresa_nome: String(f.get('empresa_nome') ?? ''),
        canal_mensagem: String(f.get('canal_mensagem') ?? ''),
        min_grupo: String(f.get('min_grupo') ?? '5'),
      })
      setOk(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui salvar.')
    }
    setPendente(false)
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && <Aviso tom="sucesso">Configurações salvas.</Aviso>}
      <Campo rotulo="Nome da empresa" ajuda="Aparece no topo do site para os colaboradores.">
        <input name="empresa_nome" defaultValue={config.empresa_nome ?? 'Soulan Recursos Humanos'} required className={ENTRADA} />
      </Campo>
      <Campo rotulo="Mensagem do canal" ajuda="Texto exibido na tela de envio de manifestações.">
        <textarea name="canal_mensagem" rows={3} defaultValue={config.canal_mensagem ?? ''} required className={ENTRADA} />
      </Campo>
      <Campo rotulo="Grupo mínimo padrão" ajuda="Recortes com menos respostas ficam ocultos nos painéis. Cinco é o mais usado.">
        <input name="min_grupo" type="number" min={1} defaultValue={config.min_grupo ?? 5} className={`${ENTRADA} max-w-[8rem]`} />
      </Campo>
      <Botao type="submit" disabled={pendente}><Save size={15} aria-hidden /> {pendente ? 'Salvando…' : 'Salvar'}</Botao>
    </form>
  )
}

export function FormNovaArea({ aoAdicionar }: { aoAdicionar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setPendente(true)
    const f = e.currentTarget
    const nome = String(new FormData(f).get('nome') ?? '')
    try {
      await adicionarArea(nome)
      f.reset()
      aoAdicionar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui adicionar.')
    }
    setPendente(false)
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <input name="nome" required placeholder="Ex.: Qualidade" className={`${ENTRADA} max-w-xs flex-1`} />
        <Botao type="submit" variante="secundario" disabled={pendente}><Plus size={15} aria-hidden /> {pendente ? 'Adicionando…' : 'Adicionar'}</Botao>
      </div>
    </form>
  )
}

export function FormMinhaSenha() {
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pendente, setPendente] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setOk(false)
    const f = new FormData(e.currentTarget)
    const nova = String(f.get('senha_nova') ?? '')
    const conf = String(f.get('confirmacao') ?? '')
    if (nova !== conf) return setErro('As duas senhas novas não são iguais.')
    setPendente(true)
    const r = await trocarSenha(String(f.get('senha_atual') ?? ''), nova)
    if (r.ok) setOk(true)
    else setErro(r.erro ?? 'Não consegui trocar a senha.')
    setPendente(false)
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && <Aviso tom="sucesso">Senha alterada.</Aviso>}
      <Campo rotulo="Senha atual" obrigatorio>
        <input name="senha_atual" type="password" required autoComplete="current-password" className={`${ENTRADA} max-w-sm`} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nova senha" ajuda="Mínimo 10 caracteres, sem o nome da empresa." obrigatorio>
          <input name="senha_nova" type="password" minLength={10} required autoComplete="new-password" className={ENTRADA} />
        </Campo>
        <Campo rotulo="Repita a nova senha" obrigatorio>
          <input name="confirmacao" type="password" minLength={10} required autoComplete="new-password" className={ENTRADA} />
        </Campo>
      </div>
      <Botao type="submit" disabled={pendente}><KeyRound size={15} aria-hidden /> {pendente ? 'Alterando…' : 'Alterar senha'}</Botao>
    </form>
  )
}
