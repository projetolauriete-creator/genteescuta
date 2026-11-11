'use client'

import { useState } from 'react'
import { entrar } from '@/lib/fb/auth'
import { Aviso, Botao, Campo, ENTRADA } from '@/components/ui'

export function FormEntrar() {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setPendente(true)
    const f = new FormData(e.currentTarget)
    const r = await entrar(String(f.get('email') ?? ''), String(f.get('senha') ?? ''))
    // O redirecionamento é feito na página /entrar (observarLogin):
    // todos vão para a home do portal (/); senha provisória vai para primeiro acesso.
    if (!r.ok) {
      setErro(r.erro ?? 'Não consegui entrar.')
      setPendente(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <Campo rotulo="E-mail" obrigatorio>
        <input name="email" type="email" autoComplete="username" required className={ENTRADA} placeholder="voce@empresa.com.br" />
      </Campo>

      <Campo rotulo="Senha" obrigatorio>
        <input name="senha" type="password" autoComplete="current-password" required className={ENTRADA} />
      </Campo>

      <Botao type="submit" disabled={pendente} className="w-full">
        {pendente ? 'Entrando…' : 'Entrar'}
      </Botao>
    </form>
  )
}
