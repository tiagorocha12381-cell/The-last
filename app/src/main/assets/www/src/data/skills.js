export const SKILL_TREE = [
  {
    id: 'survival', name: 'Sobrevivência', skills: [
      { id: 'sv_energy', name: 'Reserva de Energia', desc: 'Aumenta energia máxima.', maxRank: 3, cost: 1, effects: [{ stat:'maxEnergy', perRank:8 }] },
      { id: 'sv_efficiency', name: 'Aproveitamento', desc: 'Consumíveis restauram mais.', maxRank: 3, cost: 1, requires: { sv_energy: 1 }, effects: [{ stat:'consumableBonus', perRank:0.08 }] },
      { id: 'sv_endurance', name: 'Resistência à Exaustão', desc: 'Fome/sede drenam mais devagar.', maxRank: 3, cost: 1, requires: { sv_energy: 1 }, effects: [{ stat:'survivalDecayMult', perRank:-0.06 }] },
      { id: 'sv_recovery', name: 'Recuperação Eficiente', desc: 'Descanso e regeneração melhores.', maxRank: 2, cost: 1, requires: { sv_endurance: 2 }, effects: [{ stat:'restBonus', perRank:0.12 }] },
    ]
  },
  {
    id: 'exploration', name: 'Exploração', skills: [
      { id: 'ex_scavenge', name: 'Catador', desc: 'Maior chance de recursos extras em saque.', maxRank: 3, cost: 1, effects: [{ stat:'lootBonus', perRank:0.12 }] },
      { id: 'ex_carry', name: 'Mochila Reforçada', desc: 'Aumenta capacidade do inventário.', maxRank: 3, cost: 1, requires: { ex_scavenge: 1 }, effects: [{ stat:'inventorySlots', perRank:2 }] },
      { id: 'ex_detect', name: 'Olhar Atento', desc: 'Detecta pontos de interesse a maior distância.', maxRank: 2, cost: 1, requires: { ex_scavenge: 1 }, effects: [{ stat:'discoveryRadius', perRank:0.2 }] },
      { id: 'ex_craft', name: 'Mãos Habilidosas', desc: 'Chance de economizar material ao fabricar.', maxRank: 2, cost: 1, requires: { ex_carry: 1 }, effects: [{ stat:'craftSaveChance', perRank:0.1 }] },
    ]
  },
  {
    id: 'combat', name: 'Combate', skills: [
      { id: 'cb_weapon', name: 'Controle de Armas', desc: 'Aumenta dano corpo a corpo.', maxRank: 3, cost: 1, effects: [{ stat:'damageMult', perRank:0.06 }] },
      { id: 'cb_reload', name: 'Ataque Eficiente', desc: 'Reduz cooldown de ataque.', maxRank: 3, cost: 1, requires: { cb_weapon: 1 }, effects: [{ stat:'attackCooldownMult', perRank:-0.05 }] },
      { id: 'cb_equipment', name: 'Aproveitamento de Equipamento', desc: 'Melhora dano especial.', maxRank: 2, cost: 1, requires: { cb_weapon: 1 }, effects: [{ stat:'specialDamageMult', perRank:0.08 }] },
      { id: 'cb_resist', name: 'Resistência em Confronto', desc: 'Reduz dano recebido.', maxRank: 3, cost: 1, requires: { cb_reload: 1 }, effects: [{ stat:'damageTakenMult', perRank:-0.05 }] },
    ]
  },
];

export function flattenSkills() {
  const out = [];
  for (const cat of SKILL_TREE) for (const s of cat.skills) out.push({ ...s, category: cat.id, categoryName: cat.name });
  return out;
}
