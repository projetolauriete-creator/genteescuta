'use client'

// =============================================================
// Exportações padronizadas do portal (identidade visual única).
//  - baixarCSV: dados crus, sem logo (CSV não suporta imagem).
//  - exportarXlsx: Excel com o logo no topo, título, filtros e data,
//    e o cabeçalho das colunas (via ExcelJS, que insere imagem).
//  - cabecalhoImpressaoHtml: cabeçalho com logo para os PDFs que abrem
//    uma janela de impressão.
// O logo fica em public/logo-soulan.png; nenhuma tela precisa configurar.
// =============================================================

const LOGO = '/logo-soulan.png'

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function comExtensao(nome: string, ext: string): string {
  return nome.toLowerCase().endsWith('.' + ext) ? nome : `${nome}.${ext}`
}

function esc(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

/** Linha de filtros + data de geração (texto curto para cabeçalhos). */
export function rodapeGeracao(filtros?: string): string {
  const data = new Date().toLocaleString('pt-BR')
  return `${filtros && filtros.trim() ? filtros.trim() + ' · ' : ''}Gerado em ${data}`
}

/** CSV cru (sem logo), com BOM para acentos abrirem certo no Excel. */
export function baixarCSV(nomeArquivo: string, colunas: string[], linhas: (string | number)[][]) {
  const linhasTxt = [colunas.map(esc).join(';')]
  for (const linha of linhas) linhasTxt.push(linha.map(esc).join(';'))
  const blob = new Blob(['﻿' + linhasTxt.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  baixarBlob(blob, comExtensao(nomeArquivo, 'csv'))
}

async function logoBase64(): Promise<string | null> {
  try {
    const buf = await (await fetch(LOGO)).arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
    return btoa(bin)
  } catch {
    return null
  }
}

/** Uma linha do bloco "Resumo" no topo da planilha (rótulo, quantidade, valor). */
export interface ResumoXlsx {
  rotulo: string
  qtd: number
  valor: string
}

export interface OpcoesXlsx {
  nomeArquivo: string
  titulo: string
  filtros?: string
  colunas: string[]
  linhas: (string | number)[][]
  nomeAba?: string
  /** Larguras das colunas (opcional). */
  larguras?: number[]
  /** Bloco de totais no topo (antes do cabeçalho das colunas). */
  resumo?: ResumoXlsx[]
  /** Linha de TOTAL no final (já formatada, mesmo número de colunas). */
  totalLinha?: (string | number)[]
}

/** Excel (.xlsx) com o logo no topo, título/filtros/data e cabeçalho de colunas. */
export async function exportarXlsx(o: OpcoesXlsx): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(o.nomeAba || 'Dados')
  const ncol = Math.max(1, o.colunas.length)
  ws.columns = o.colunas.map((_, i) => ({ width: o.larguras?.[i] ?? 22 }))

  // Logo nas primeiras linhas.
  const base64 = await logoBase64()
  if (base64) {
    const imgId = wb.addImage({ base64, extension: 'png' })
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 200, height: 56 } })
  }

  // Título, filtros e data (abaixo do logo).
  ws.mergeCells(5, 1, 5, ncol)
  Object.assign(ws.getCell(5, 1), { value: o.titulo, font: { bold: true, size: 14 } })
  ws.mergeCells(6, 1, 6, ncol)
  Object.assign(ws.getCell(6, 1), { value: rodapeGeracao(o.filtros), font: { size: 10, color: { argb: 'FF6B6B6B' } } })

  // Bloco "Resumo" (totais do que está sendo exportado), quando houver.
  let linhaCabecalho = 8
  if (o.resumo && o.resumo.length) {
    ws.mergeCells(8, 1, 8, ncol)
    Object.assign(ws.getCell(8, 1), { value: 'Resumo (referente ao que foi exportado)', font: { bold: true, size: 11 } })
    let rr = 9
    for (const item of o.resumo) {
      Object.assign(ws.getCell(rr, 1), { value: item.rotulo, font: { bold: true } })
      Object.assign(ws.getCell(rr, 2), { value: item.qtd, alignment: { horizontal: 'left' } })
      Object.assign(ws.getCell(rr, 3), { value: item.valor })
      rr++
    }
    linhaCabecalho = rr + 1 // uma linha em branco antes da tabela
  }

  // Cabeçalho das colunas (faixa azul da marca).
  const hr = ws.getRow(linhaCabecalho)
  hr.values = o.colunas
  hr.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A4895' } }
    c.alignment = { vertical: 'middle' }
  })

  // Dados.
  let r = linhaCabecalho + 1
  for (const linha of o.linhas) {
    ws.getRow(r).values = linha
    r++
  }

  // Linha de TOTAL ao final (soma da coluna de valores), quando houver.
  if (o.totalLinha && o.totalLinha.length) {
    const tr = ws.getRow(r)
    tr.values = o.totalLinha
    tr.eachCell((c) => {
      c.font = { bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2EFEA' } }
    })
  }

  const out = await wb.xlsx.writeBuffer()
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  baixarBlob(blob, comExtensao(o.nomeArquivo, 'xlsx'))
}

/** Cabeçalho (logo + título + filtros + data) para as janelas de impressão (PDF). */
export function cabecalhoImpressaoHtml(titulo: string, filtros?: string): string {
  const tituloSeguro = String(titulo ?? '').replace(/</g, '&lt;')
  const apoio = rodapeGeracao(filtros).replace(/</g, '&lt;')
  return `
    <div style="display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid #e2e7ee;padding-bottom:12px;margin-bottom:16px;">
      <img src="${LOGO}" alt="Soulan" style="height:44px;width:auto" />
      <div>
        <h1 style="margin:0;font-size:18px;color:#04243f;font-family:Arial,Helvetica,sans-serif;">${tituloSeguro}</h1>
        <p style="margin:2px 0 0;font-size:12px;color:#6c7b8c;font-family:Arial,Helvetica,sans-serif;">${apoio}</p>
      </div>
    </div>`
}
