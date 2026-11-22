export const ITEM_DEFS = {
  canned_food: { id: 'canned_food', name: 'Comida enlatada', description: 'Lata de feijão preservada. Recupera fome e um pouco de energia.', type: 'comida', icon: '🥫', consumable: true, effects: { hunger: 28, energy: 6 }, weight: 0.6, stackMax: 8, rarity: 'comum' },
  water_bottle: { id: 'water_bottle', name: 'Água potável', description: 'Garrafa de água filtrada. Recupera sede.', type: 'água', icon: '💧', consumable: true, effects: { thirst: 32 }, weight: 0.8, stackMax: 8, rarity: 'comum' },
  bandage: { id: 'bandage', name: 'Bandagem', description: 'Bandagem limpa para primeiros socorros. Recupera vida.', type: 'medicamento', icon: '🩹', consumable: true, effects: { hp: 18 }, weight: 0.2, stackMax: 10, rarity: 'comum' },
  energy_bar: { id: 'energy_bar', name: 'Barra energética', description: 'Barra calórica de emergência. Recupera fome e energia.', type: 'comida', icon: '🍫', consumable: true, effects: { hunger: 15, energy: 14 }, weight: 0.2, stackMax: 10, rarity: 'comum' },
  medkit: { id: 'medkit', name: 'Kit médico', description: 'Kit de primeiros socorros. Recupera bastante vida.', type: 'medicamento', icon: '🧰', consumable: true, effects: { hp: 40 }, weight: 1.0, stackMax: 5, rarity: 'incomum' },
  scrap_metal: { id: 'scrap_metal', name: 'Sucata metálica', description: 'Peças de metal úteis para reparos e crafting.', type: 'material', icon: '⚙️', weight: 0.7, stackMax: 20, rarity: 'comum' },
  wood_plank: { id: 'wood_plank', name: 'Tábua de madeira', description: 'Madeira reaproveitável para barricadas e reparos.', type: 'material', icon: '🪵', weight: 0.9, stackMax: 20, rarity: 'comum' },
  fabric: { id: 'fabric', name: 'Tecido', description: 'Retalho de tecido. Útil para bandagens e reparos.', type: 'material', icon: '🧵', weight: 0.2, stackMax: 20, rarity: 'comum' },
  electronic_parts: { id: 'electronic_parts', name: 'Componentes eletrônicos', description: 'Circuitos e componentes para consertar equipamentos.', type: 'peça', icon: '🔌', weight: 0.4, stackMax: 15, rarity: 'incomum' },
  mechanical_parts: { id: 'mechanical_parts', name: 'Peças mecânicas', description: 'Engrenagens e peças úteis para ferramentas e veículos.', type: 'peça', icon: '🔩', weight: 0.6, stackMax: 15, rarity: 'comum' },
  battery: { id: 'battery', name: 'Bateria', description: 'Bateria portátil com carga residual.', type: 'peça', icon: '🔋', weight: 0.5, stackMax: 10, rarity: 'incomum' },
  mission_key: { id: 'mission_key', name: 'Chave de acesso', description: 'Chave antiga encontrada em um escritório. Pode abrir uma área importante.', type: 'missão', icon: '🗝️', weight: 0.1, stackMax: 1, rarity: 'raro' },
  map_fragment: { id: 'map_fragment', name: 'Fragmento de mapa', description: 'Pedaço de mapa com marcações de rotas de evacuação.', type: 'missão', icon: '🗺️', weight: 0.1, stackMax: 5, rarity: 'incomum' },
  repair_kit: { id: 'repair_kit', name: 'Kit de reparo simples', description: 'Kit básico para reparar veículos danificados.', type: 'ferramenta', icon: '🧰', consumable: true, effects: { vehicleRepair: 35 }, weight: 1.5, stackMax: 5, rarity: 'incomum' },
  basic_tool: { id: 'basic_tool', name: 'Ferramenta básica', description: 'Ferramenta improvisada para desmontagem e reparos.', type: 'ferramenta', icon: '🛠️', weight: 1.2, stackMax: 5, rarity: 'comum' },
  note_survivor: { id: 'note_survivor', name: 'Bilhete de sobrevivente', description: 'Um bilhete manuscrito deixado por alguém que passou por aqui.', type: 'documento', icon: '📄', weight: 0.1, stackMax: 10, rarity: 'comum' },
  military_report: { id: 'military_report', name: 'Relatório militar', description: 'Documento parcial sobre a quarentena em Manhattan.', type: 'documento', icon: '📋', weight: 0.1, stackMax: 10, rarity: 'incomum' },
  photo_family: { id: 'photo_family', name: 'Foto de família', description: 'Uma foto antiga. Lembra que ainda há motivos para lutar.', type: 'documento', icon: '🖼️', weight: 0.1, stackMax: 10, rarity: 'comum' },
  keycard_research: { id: 'keycard_research', name: 'Cartão de acesso', description: 'Cartão de acesso de uma instalação de pesquisa abandonada.', type: 'missão', icon: '💳', weight: 0.1, stackMax: 1, rarity: 'raro' },
  rare_meds: { id: 'rare_meds', name: 'Antibióticos raros', description: 'Medicamento raro e valioso. Recupera muita vida.', type: 'medicamento', icon: '💊', consumable: true, effects: { hp: 55 }, weight: 0.3, stackMax: 5, rarity: 'raro' },
  ammo_9mm: { id: 'ammo_9mm', name: 'Munição 9mm', description: 'Caixa de munição 9mm para pistolas.', type: 'municao', icon: '🔫', weight: 0.02, stackMax: 60, rarity: 'comum' },
  ammo_shell: { id: 'ammo_shell', name: 'Cartuchos de Escopeta', description: 'Cartuchos calibre 12 para escopetas.', type: 'municao', icon: '🧨', weight: 0.08, stackMax: 24, rarity: 'incomum' },
  ammo_rifle: { id: 'ammo_rifle', name: 'Munição de Fuzil', description: 'Munição para fuzis de sobrevivência.', type: 'municao', icon: '📦', weight: 0.03, stackMax: 45, rarity: 'incomum' },
  eq_pistol: { id: 'eq_pistol', name: 'Pistola 9mm', description: 'Arma de fogo leve. Munição escassa.', type: 'equipamento', category: 'arma-fogo', rarity: 'incomum', icon: '🔫', weight: 1.2, stackMax: 1, stats: { damage: 38, range: 18, cooldown: 0.45, specialDamage: 38, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_9mm', magSize: 10, reloadTime: 1.6 } },
  eq_shotgun:{ id: 'eq_shotgun',name: 'Escopeta Curta', description: 'Alto dano em curta distância. Recarga lenta.', type: 'equipamento', category: 'arma-fogo', rarity: 'raro', icon: '💥', weight: 3.4, stackMax: 1, stats: { damage: 72, range: 8, cooldown: 0.95, specialDamage: 72, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_shell', magSize: 5, reloadTime: 2.4 } },
  eq_rifle:  { id: 'eq_rifle',  name: 'Fuzil de Sobrevivência', description: 'Preciso e forte, mas munição rara.', type: 'equipamento', category: 'arma-fogo', rarity: 'épico', icon: '🎯', weight: 3.0, stackMax: 1, stats: { damage: 55, range: 28, cooldown: 0.75, specialDamage: 55, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_rifle', magSize: 15, reloadTime: 2.0 } },
};

export const LOOT_TABLES = {
  common: [
    { item: 'scrap_metal', weight: 30, min: 1, max: 2 },
    { item: 'wood_plank', weight: 25, min: 1, max: 2 },
    { item: 'fabric', weight: 20, min: 1, max: 2 },
    { item: 'canned_food', weight: 15, min: 1, max: 1 },
    { item: 'water_bottle', weight: 15, min: 1, max: 1 },
  ],
  medical: [
    { item: 'bandage', weight: 40, min: 1, max: 2 },
    { item: 'medkit', weight: 15, min: 1, max: 1 },
    { item: 'fabric', weight: 25, min: 1, max: 2 },
    { item: 'water_bottle', weight: 20, min: 1, max: 1 },
  ],
  mechanical: [
    { item: 'scrap_metal', weight: 32, min: 1, max: 3 },
    { item: 'mechanical_parts', weight: 23, min: 1, max: 2 },
    { item: 'electronic_parts', weight: 14, min: 1, max: 1 },
    { item: 'battery', weight: 9, min: 1, max: 1 },
    { item: 'wood_plank', weight: 14, min: 1, max: 2 },
    { item: 'ammo_9mm', weight: 5, min: 3, max: 6 },
    { item: 'ammo_shell', weight: 3, min: 1, max: 2 },
  ],
  vehicle: [
    { item: 'scrap_metal', weight: 28, min: 1, max: 2 },
    { item: 'mechanical_parts', weight: 27, min: 1, max: 2 },
    { item: 'battery', weight: 14, min: 1, max: 1 },
    { item: 'electronic_parts', weight: 9, min: 1, max: 1 },
    { item: 'water_bottle', weight: 14, min: 1, max: 1 },
    { item: 'ammo_9mm', weight: 5, min: 2, max: 5 },
    { item: 'ammo_rifle', weight: 3, min: 2, max: 4 },
  ],
  food: [
    { item: 'canned_food', weight: 35, min: 1, max: 2 },
    { item: 'water_bottle', weight: 35, min: 1, max: 2 },
    { item: 'energy_bar', weight: 20, min: 1, max: 1 },
    { item: 'bandage', weight: 10, min: 1, max: 1 },
  ],
  military: [
    { item: 'ammo_9mm', weight: 35, min: 4, max: 10 },
    { item: 'ammo_shell', weight: 20, min: 2, max: 4 },
    { item: 'ammo_rifle', weight: 20, min: 3, max: 6 },
    { item: 'eq_pistol', weight: 10, min: 1, max: 1 },
    { item: 'eq_shotgun', weight: 8, min: 1, max: 1 },
    { item: 'eq_rifle', weight: 7, min: 1, max: 1 },
  ],
};

export function rollLoot(tableName, rng = Math.random) {
  const table = LOOT_TABLES[tableName] || LOOT_TABLES.common;
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      const qty = e.min + Math.floor(rng() * (e.max - e.min + 1));
      const def = ITEM_DEFS[e.item];
      return def ? { def: { ...def }, qty } : null;
    }
  }
  const last = table[table.length - 1];
  const def = ITEM_DEFS[last.item];
  return def ? { def: { ...def }, qty: last.min } : null;
}

export function rollLootMany(tableName, count = 2, rng = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = rollLoot(tableName, rng);
    if (r) out.push(r);
  }
  // merge same ids
  const merged = [];
  for (const r of out) {
    const ex = merged.find(m => m.def.id === r.def.id);
    if (ex) ex.qty += r.qty; else merged.push(r);
  }
  return merged;
}

export const CRAFTING_RECIPES = [
  {
    id: 'craft_repair_kit',
    name: 'Kit de reparo simples',
    description: 'Repara veículos danificados.',
    result: { itemId: 'repair_kit', qty: 1 },
    ingredients: [
      { itemId: 'scrap_metal', qty: 2 },
      { itemId: 'mechanical_parts', qty: 1 },
      { itemId: 'fabric', qty: 1 },
    ],
  },
  {
    id: 'craft_medkit',
    name: 'Kit médico',
    description: 'Recupera bastante vida.',
    result: { itemId: 'medkit', qty: 1 },
    ingredients: [
      { itemId: 'bandage', qty: 2 },
      { itemId: 'fabric', qty: 1 },
      { itemId: 'water_bottle', qty: 1 },
    ],
  },
  {
    id: 'craft_bandage',
    name: 'Bandagem',
    description: 'Bandagem improvisada para primeiros socorros.',
    result: { itemId: 'bandage', qty: 1 },
    ingredients: [
      { itemId: 'fabric', qty: 2 },
    ],
  },
  {
    id: 'craft_water',
    name: 'Água potável',
    description: 'Filtra água com materiais disponíveis (representação simplificada).',
    result: { itemId: 'water_bottle', qty: 1 },
    ingredients: [
      { itemId: 'fabric', qty: 1 },
      { itemId: 'scrap_metal', qty: 1 },
      { itemId: 'wood_plank', qty: 1 },
    ],
  },
  {
    id: 'craft_basic_tool',
    name: 'Ferramenta básica',
    description: 'Ferramenta improvisada para reparos e desmontagem.',
    result: { itemId: 'basic_tool', qty: 1 },
    ingredients: [
      { itemId: 'scrap_metal', qty: 2 },
      { itemId: 'wood_plank', qty: 1 },
    ],
  },
  {
    id: 'craft_energy_bar',
    name: 'Barra energética',
    description: 'Ração improvisada para recuperar fome e energia.',
    result: { itemId: 'energy_bar', qty: 1 },
    ingredients: [
      { itemId: 'canned_food', qty: 1 },
      { itemId: 'wood_plank', qty: 1 },
    ],
  },
];
