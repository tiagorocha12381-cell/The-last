export const STRUCTURE_DEFS = {
  barricade: {
    id: 'barricade', name: 'Barricada', icon: '🪵',
    description: 'Barreira reforçada que bloqueia passagem e aumenta proteção.',
    cost: [{ id: 'wood_plank', qty: 4 }, { id: 'scrap_metal', qty: 2 }],
    hp: 100, category: 'Defesa',
  },
  reinforced_door: {
    id: 'reinforced_door', name: 'Porta Reforçada', icon: '🚪',
    description: 'Porta que pode ser aberta/fechada para controlar acesso.',
    cost: [{ id: 'wood_plank', qty: 3 }, { id: 'scrap_metal', qty: 3 }, { id: 'mechanical_parts', qty: 1 }],
    hp: 140, category: 'Defesa',
  },
  reinforced_window: {
    id: 'reinforced_window', name: 'Janela Reforçada', icon: '🪟',
    description: 'Reforço de janela com tábuas e metal, melhora proteção.',
    cost: [{ id: 'wood_plank', qty: 2 }, { id: 'scrap_metal', qty: 1 }],
    hp: 80, category: 'Defesa',
  },
  storage_crate: {
    id: 'storage_crate', name: 'Caixa de Armazenamento', icon: '📦',
    description: 'Armazena itens fora do inventário. Conteúdo salvo.',
    cost: [{ id: 'wood_plank', qty: 5 }, { id: 'scrap_metal', qty: 2 }],
    hp: 90, category: 'Utilidade', storageSlots: 12,
  },
  workbench: {
    id: 'workbench', name: 'Bancada de Trabalho', icon: '🛠️',
    description: 'Bancada para suporte de crafting/manutenção no abrigo.',
    cost: [{ id: 'wood_plank', qty: 4 }, { id: 'scrap_metal', qty: 3 }, { id: 'basic_tool', qty: 1 }],
    hp: 110, category: 'Utilidade',
  },
  light: {
    id: 'light', name: 'Iluminação', icon: '💡',
    description: 'Luz de abrigo. Melhora visibilidade e conforto.',
    cost: [{ id: 'electronic_parts', qty: 2 }, { id: 'scrap_metal', qty: 1 }, { id: 'battery', qty: 1 }],
    hp: 50, category: 'Utilidade',
  },
  rest_area: {
    id: 'rest_area', name: 'Área de Descanso', icon: '🛏️',
    description: 'Cama improvisada para descanso seguro no abrigo.',
    cost: [{ id: 'fabric', qty: 4 }, { id: 'wood_plank', qty: 3 }],
    hp: 70, category: 'Utilidade',
  },
};

export const SHELTER_SITES = [
  {
    id: 'site_market',
    name: 'Abrigo do Mercado',
    desc: 'Abrigo existente com sobreviventes. Pode ser reforçado e gerenciado.',
    center: { x: 28, y: 0.18, z: 28 },
    radius: 10,
    claimable: true,
    preClaimed: true, // existing NPC shelter
    slots: [
      { id: 'm_s1', type: 'barricade', pos: { x: 24.8, y: 0.18, z: 32.2 }, ry: 0 },
      { id: 'm_s2', type: 'barricade', pos: { x: 31.2, y: 0.18, z: 32.2 }, ry: 0 },
      { id: 'm_s3', type: 'reinforced_door', pos: { x: 28.0, y: 0.18, z: 32.0 }, ry: 0 },
      { id: 'm_s4', type: 'storage_crate', pos: { x: 24.8, y: 0.18, z: 25.5 }, ry: 0.2 },
      { id: 'm_s5', type: 'workbench', pos: { x: 31.2, y: 0.18, z: 25.5 }, ry: -0.2 },
      { id: 'm_s6', type: 'light', pos: { x: 28.0, y: 2.5, z: 28.0 }, ry: 0 },
      { id: 'm_s7', type: 'storage_crate', pos: { x: 31.0, y: 0.18, z: 26.8 }, ry: 0 },
      { id: 'm_s8', type: 'reinforced_window', pos: { x: 23.2, y: 1.0, z: 28.0 }, ry: Math.PI/2 },
    ],
  },
  {
    id: 'site_garage',
    name: 'Garagem Abandonada',
    desc: 'Garagem vazia em área urbana. Bom local para converter em abrigo.',
    center: { x: -42, y: 0.18, z: 62 },
    radius: 9,
    claimable: true,
    preClaimed: false,
    slots: [
      { id: 'g_s1', type: 'barricade', pos: { x: -45.0, y: 0.18, z: 66.0 }, ry: 0 },
      { id: 'g_s2', type: 'barricade', pos: { x: -39.0, y: 0.18, z: 66.0 }, ry: 0 },
      { id: 'g_s3', type: 'reinforced_door', pos: { x: -42.0, y: 0.18, z: 66.2 }, ry: 0 },
      { id: 'g_s4', type: 'storage_crate', pos: { x: -45.2, y: 0.18, z: 59.0 }, ry: 0.1 },
      { id: 'g_s5', type: 'workbench', pos: { x: -38.8, y: 0.18, z: 59.0 }, ry: -0.1 },
      { id: 'g_s6', type: 'light', pos: { x: -42.0, y: 2.6, z: 62.0 }, ry: 0 },
      { id: 'g_s7', type: 'rest_area', pos: { x: -39.0, y: 0.18, z: 59.5 }, ry: 0 },
      { id: 'g_s8', type: 'reinforced_window', pos: { x: -46.5, y: 1.0, z: 62.0 }, ry: Math.PI/2 },
    ],
  },
];
