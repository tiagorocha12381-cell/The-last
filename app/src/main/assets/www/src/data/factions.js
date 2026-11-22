export const FACTIONS = [
  {
    id: 'refugio_mercado',
    name: 'Refúgio do Mercado',
    identity: 'Comunidade de sobreviventes que protege o abrigo do mercado.',
    history: 'Formado por moradores e trabalhadores que resistiram aos primeiros dias da quarentena em Manhattan.',
    objective: 'Proteger civis, manter suprimentos e reconstruir um ponto seguro.',
    base: { name: 'Abrigo do Mercado', pos: { x: 28, z: 28 }, radius: 12 },
    color: '#7fb0ff',
    defaultRep: 10,
  },
  {
    id: 'sentinelas_ferrovia',
    name: 'Sentinelas da Ferrovia',
    identity: 'Grupo armado que vigia rotas de metrô e túneis de evacuação.',
    history: 'Ex-agentes de segurança e ferroviários que se organizaram para controlar passagens subterrâneas.',
    objective: 'Controlar rotas seguras, coletar informações e impedir hordas nos túneis.',
    base: { name: 'Posto da Ferrovia', pos: { x: -10, z: 92 }, radius: 12 },
    color: '#ffbf66',
    defaultRep: 0,
  },
  {
    id: 'catadores',
    name: 'Os Catadores',
    identity: 'Coletivos pragmáticos que vivem de sucata, peças e trocas.',
    history: 'Mecânicos e catadores que transformaram garagens abandonadas em oficinas fortificadas.',
    objective: 'Recuperar recursos, manter veículos e negociar por sobrevivência.',
    base: { name: 'Oficina dos Catadores', pos: { x: -74, z: 10 }, radius: 12 },
    color: '#9ad06b',
    defaultRep: 0,
  },
];

export function repStatus(rep = 0) {
  if (rep >= 35) return 'amigável';
  if (rep <= -20) return 'hostil';
  return 'neutro';
}
