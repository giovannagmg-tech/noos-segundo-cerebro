// Paleta fixa de cores de tag — usada como ponto colorido ao lado do nome
// (não como fundo do pill inteiro, pra não ter que resolver contraste texto/fundo
// pra cada cor escolhida pelo usuário).
export const TAG_COLORS = [
  { name: 'Vermelho', value: '#e5484d' },
  { name: 'Laranja', value: '#f76b15' },
  { name: 'Âmbar', value: '#ffb224' },
  { name: 'Verde', value: '#30a46c' },
  { name: 'Ciano', value: '#00a2c7' },
  { name: 'Azul', value: '#0090ff' },
  { name: 'Roxo', value: '#8e4ec6' },
  { name: 'Rosa', value: '#d6409f' },
] as const

export function nextTagColor(usedCount: number): string {
  return TAG_COLORS[usedCount % TAG_COLORS.length].value
}
