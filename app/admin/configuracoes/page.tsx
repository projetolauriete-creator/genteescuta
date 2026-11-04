'use client'

import { useEffect, useState } from 'react'
import { X, RotateCcw, ShieldCheck } from 'lucide-react'
import { configCompleta, definirAreaAtiva } from '@/lib/fb/admin'
import { minhaConta, type Conta } from '@/lib/fb/usuarios'
import { CabecalhoPagina, Cartao, Aviso } from '@/components/ui'
import { FormEmpresa, FormNovaArea, FormMinhaSenha, FormReembolsoConfig } from '@/components/FormConfig'

export default function Configuracoes() {
  const [eu, setEu] = useState<Conta | null | undefined>(undefined)
  const [config, setConfig] = useState<any>({ empresa_nome: 'Soulan Recursos Humanos', min_grupo: 5 })
  const [areas, setAreas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  function recarregar() {
    configCompleta().then((r) => { setConfig(r.config); setAreas(r.areas) }).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => {
    minhaConta().then(setEu).catch(() => setEu(null))
    recarregar()
  }, [])

  const souSuper = !!eu?.ativo && eu?.nivel === 'super'

  if (eu === undefined) {
    return (
      <>
        <CabecalhoPagina titulo="Configurações" />
        <p className="p-6 text-sm text-tinta-3">Carregando…</p>
      </>
    )
  }
  if (!souSuper) {
    return (
      <>
        <CabecalhoPagina titulo="Configurações" />
        <div className="p-4 sm:p-6">
          <Aviso tom="alerta" titulo="Acesso restrito">
            Apenas o <strong>Super Admin</strong> edita as configurações do sistema.
          </Aviso>
        </div>
      </>
    )
  }

  const ativas = areas.filter((a) => a.ativa)
  const inativas = areas.filter((a) => !a.ativa)

  async function toggle(id: string, ativa: boolean) {
    await definirAreaAtiva(id, ativa)
    recarregar()
  }

  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Dados da empresa, áreas usadas nos recortes e sua senha." />

      <div className="max-w-4xl space-y-4 p-4 sm:p-6">
        <Cartao titulo="Empresa">
          {carregando ? <p className="text-sm text-tinta-3">Carregando…</p> : <FormEmpresa config={config} />}
        </Cartao>

        <Cartao titulo="Áreas da empresa" apoio="Aparecem no canal e nos recortes dos painéis.">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {ativas.map((area) => (
              <span key={area.id} className="inline-flex items-center gap-1.5 rounded-full border border-borda-forte bg-white py-1 pl-3 pr-1.5 text-xs font-medium text-tinta-2">
                {area.nome}
                <button type="button" onClick={() => toggle(area.id, false)} aria-label={`Desativar ${area.nome}`} className="flex h-4 w-4 items-center justify-center rounded-full text-tinta-3 hover:bg-plano hover:text-critico"><X size={11} aria-hidden /></button>
              </span>
            ))}
            {ativas.length === 0 && <p className="text-sm text-tinta-3">Nenhuma área ativa no momento.</p>}
          </div>

          <FormNovaArea aoAdicionar={recarregar} />

          {inativas.length > 0 && (
            <div className="mt-5 border-t border-borda pt-4">
              <p className="mb-2 text-xs font-medium text-tinta-3">Áreas desativadas (os dados históricos continuam preservados)</p>
              <div className="flex flex-wrap gap-1.5">
                {inativas.map((area) => (
                  <span key={area.id} className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-plano py-1 pl-3 pr-1.5 text-xs text-tinta-3">
                    {area.nome}
                    <button type="button" onClick={() => toggle(area.id, true)} aria-label={`Reativar ${area.nome}`} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white hover:text-marca"><RotateCcw size={10} aria-hidden /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Reembolso" apoio="Taxa por quilômetro usada no cálculo automático das despesas de KM.">
          <FormReembolsoConfig />
        </Cartao>

        <Cartao titulo="Minha senha" apoio="Troque a senha provisória. Depois de trocar, use a nova para entrar.">
          <FormMinhaSenha />
        </Cartao>

        <div className="rounded-md border border-borda bg-white px-4 py-3">
          <p className="flex items-start gap-2.5 text-xs leading-4 text-tinta-2">
            <ShieldCheck size={16} className="mt-0.5 flex-none text-marca" aria-hidden />
            O login usa o Firebase Authentication do Google. Para dar acesso a mais pessoas, crie o usuário em Authentication no Console do Firebase, e me avise para liberar o acesso dele nas regras.
          </p>
        </div>
      </div>
    </>
  )
}
