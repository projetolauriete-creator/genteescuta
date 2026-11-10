'use client'

import { GestaoDocumentos } from '@/components/GestaoDocumentos'

// A Sala de documentos também vive como aba dentro da Central de Conhecimento
// (/admin/treinamento). Esta rota própria segue funcionando para links salvos.
export default function AdminDocumentos() {
  return <GestaoDocumentos />
}
