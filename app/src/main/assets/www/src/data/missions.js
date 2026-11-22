export const MISSIONS = [
  {
    id: 'm1_sinal_nevoa',
    name: 'Sinal na Névoa',
    description: 'Um bilhete rasgado menciona um transmissor improvisado nas ruínas de Manhattan. Encontre pistas e tente enviar um sinal de sobrevivência.',
    type: 'main',
    state: 'available',
    rewards: [
      { kind: 'item', item: { id: 'battery', name: 'Bateria', description: 'Bateria portátil com carga residual. Útil para equipamentos.', type: 'peça', icon: '🔋' }, qty: 2 },
      { kind: 'item', item: { id: 'bandage', name: 'Bandagem', description: 'Bandagem limpa para primeiros socorros. Recupera vida.', type: 'material', icon: '🩹', consumable: true, effects: { hp: 18 } }, qty: 1 },
      { kind: 'info', text: 'O sinal improvisado chamou atenção... mas alguém — ou algo — também pode ter ouvido.' }
    ],
    objectives: [
      { id: 'm1_find_note', text: 'Encontre o bilhete do sobrevivente', type: 'interact', target: 'm1_radio_note', current: 0, required: 1 },
      { id: 'm1_reach_radio', text: 'Alcance o transmissor improvisado', type: 'visit', target: 'm1_radio_zone', current: 0, required: 1 },
      { id: 'm1_activate_radio', text: 'Ative o transmissor improvisado', type: 'interact', target: 'm1_radio_device', current: 0, required: 1 }
    ]
  },
  {
    id: 'm2_abrigo_seguro',
    name: 'Abrigo Seguro',
    description: 'Maya, a líder do abrigo, pediu ajuda para reforçar a segurança e buscar suprimentos médicos para os sobreviventes.',
    type: 'side',
    state: 'available',
    rewards: [
      { kind: 'item', item: { id: 'medkit', name: 'Kit médico', description: 'Kit de primeiros socorros. Recupera bastante vida.', type: 'material', icon: '🧰', consumable: true, effects: { hp: 40 } }, qty: 1 },
      { kind: 'item', item: { id: 'water_bottle', name: 'Água potável', description: 'Garrafa de água filtrada. Recupera sede.', type: 'água', icon: '💧', consumable: true, effects: { thirst: 32 } }, qty: 2 },
      { kind: 'info', text: 'Os sobreviventes do abrigo agora confiam mais em você.' }
    ],
    objectives: [
      { id: 'm2_talk_maya', text: 'Fale com Maya no abrigo', type: 'interact', target: 'npc_maya', current: 0, required: 1 },
      { id: 'm2_find_meds', text: 'Encontre suprimentos médicos', type: 'collect', target: 'medkit', current: 0, required: 1 },
      { id: 'm2_return_maya', text: 'Entregue os suprimentos para Maya', type: 'interact', target: 'npc_maya_return', current: 0, required: 1 }
    ]
  },
  {
    id: 'm3_rota_segura',
    name: 'Rota Segura',
    description: 'Jonas, dos Sentinelas da Ferrovia, pediu para você verificar um ponto perigoso perto da estação sul e marcar a rota como segura.',
    type: 'faction',
    factionId: 'sentinelas_ferrovia',
    state: 'available',
    rewards: [
      { kind: 'item', item: { id: 'battery', name: 'Bateria', description: 'Bateria portátil com carga residual.', type: 'peça', icon: '🔋' }, qty: 1 },
      { kind: 'item', item: { id: 'energy_bar', name: 'Barra energética', description: 'Barra calórica de emergência. Recupera fome e energia.', type: 'comida', icon: '🍫', consumable: true, effects: { hunger: 15, energy: 14 } }, qty: 2 },
      { kind: 'info', text: 'Os Sentinelas da Ferrovia passaram a confiar mais em você.' }
    ],
    objectives: [
      { id: 'm3_reach', text: 'Vá até o ponto de risco perto da estação sul', type: 'visit', target: 'm3_route_zone', current: 0, required: 1 },
      { id: 'm3_mark', text: 'Marque a rota segura no sinalizador', type: 'interact', target: 'm3_route_marker', current: 0, required: 1 }
    ]
  },
  {
    id: 'm4_pecas_criticas',
    name: 'Peças Críticas',
    description: 'Tess, dos Catadores, precisa de peças mecânicas para manter a oficina funcionando.',
    type: 'faction',
    factionId: 'catadores',
    state: 'available',
    rewards: [
      { kind: 'item', item: { id: 'repair_kit', name: 'Kit de reparo simples', description: 'Kit básico para reparar veículos danificados.', type: 'ferramenta', icon: '🧰', consumable: true, effects: { vehicleRepair: 35 } }, qty: 1 },
      { kind: 'item', item: { id: 'scrap_metal', name: 'Sucata metálica', description: 'Peças de metal úteis para reparos e crafting.', type: 'material', icon: '⚙️' }, qty: 3 },
      { kind: 'info', text: 'Os Catadores agora oferecem melhores negócios para você.' }
    ],
    objectives: [
      { id: 'm4_collect', text: 'Colete peças mecânicas (2)', type: 'collect', target: 'mechanical_parts', current: 0, required: 2 },
      { id: 'm4_deliver', text: 'Entregue as peças para Tess', type: 'interact', target: 'npc_tess_return', current: 0, required: 1 }
    ]
  }
];
