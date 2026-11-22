export const SHELTER = {
  id: 'shelter_market',
  name: 'Abrigo do Mercado',
  center: { x: 28, z: 28 },
  radius: 8,
};

export const NPC_DEFS = [
  {
    id: 'npc_maya',
    name: 'Maya',
    role: 'Líder do abrigo',
    personality: 'calma e pragmática',
    position: { x: 28, y: 0.18, z: 26 },
    color: 0x6b8fb3,
    routine: [
      { type: 'idle', pos: { x: 28, z: 26 }, dur: 4 },
      { type: 'walk', pos: { x: 30, z: 28 }, dur: 4 },
      { type: 'idle', pos: { x: 30, z: 28 }, dur: 3 },
      { type: 'walk', pos: { x: 26, z: 30 }, dur: 4 },
      { type: 'idle', pos: { x: 26, z: 30 }, dur: 3 },
      { type: 'walk', pos: { x: 28, z: 26 }, dur: 4 },
    ],
    dialogs: {
      start: {
        text: (ctx) => ctx.flags.met_maya
          ? `Que bom ver você de volta, ${ctx.playerName}. O abrigo ainda está de pé, mas precisamos de ajuda.`
          : 'Você não parece infectado... ainda bem. Sou Maya, lidero este abrigo. Estamos segurando as barricadas, mas os suprimentos estão acabando.',
        choices: (ctx) => {
          const choices = [];
          if (!ctx.flags.met_maya) choices.push({ id: 'intro', label: 'Quem são vocês?', next: 'intro' });
          choices.push({ id: 'shelter', label: 'Este lugar é seguro?', next: 'shelter' });
          const m2 = ctx.missions.getMission('m2_abrigo_seguro');
          if (m2 && m2.state === 'available' && !ctx.flags.m2_accepted) choices.push({ id: 'need_help', label: 'Precisa de ajuda?', next: 'mission_offer' });
          if (m2 && m2.state === 'active' && !m2.objectives.find(o=>o.id==='m2_find_meds')?.completed) choices.push({ id: 'mission_hint', label: 'Onde encontro suprimentos médicos?', next: 'mission_hint' });
          if (m2 && m2.state === 'active' && m2.objectives.find(o=>o.id==='m2_find_meds')?.completed && !m2.objectives.find(o=>o.id==='m2_return_maya')?.completed) choices.push({ id: 'return_meds', label: 'Encontrei os suprimentos médicos.', next: 'mission_return' });
          if (ctx.trust >= 2) choices.push({ id: 'trust_info', label: 'Ouviu algo pelo rádio?', next: 'trust_info' });
          choices.push({ id: 'trade', label: 'Quero negociar.', action: 'trade' });
          choices.push({ id: 'bye', label: 'Fique segura.', action: 'close' });
          return choices;
        }
      },
      intro: {
        text: () => 'Somos poucos sobreviventes. Leo patrulha os arredores e Rina cuida dos feridos. Tentamos manter este mercado como um ponto seguro.',
        choices: () => [{ id: 'back', label: 'Entendi.', next: 'start', action: 'set_flag', flag: 'met_maya', trust: 1 }]
      },
      shelter: {
        text: () => 'Seguro... o máximo possível. Temos barricadas e luz, mas à noite os mortos se aproximam. Descanse quando precisar, só não baixe a guarda.',
        choices: () => [{ id: 'back', label: 'Vou lembrar disso.', next: 'start' }]
      },
      mission_offer: {
        text: () => 'Preciso que alguém busque suprimentos médicos nas ruínas próximas. Rina está cuidando de feridos e estamos sem kits. Você consegue?',
        choices: () => [
          { id: 'accept', label: 'Eu vou buscar.', next: 'mission_accept', action: 'accept_m2' },
          { id: 'later', label: 'Agora não.', next: 'start' }
        ]
      },
      mission_accept: {
        text: () => 'Obrigada. Procure por um kit médico em caixas ou armários. Volte com cuidado — e não se arrisque sem necessidade.',
        choices: () => [{ id: 'ok', label: 'Pode deixar.', action: 'close' }]
      },
      mission_hint: {
        text: () => 'Vi caixas de suprimentos perto dos prédios abandonados. Armários e gavetas também podem ter algo útil. Fique atento aos zumbis.',
        choices: () => [{ id: 'ok', label: 'Obrigado pela dica.', action: 'close' }]
      },
      mission_return: {
        text: (ctx) => ctx.inventory.hasItem('medkit') ? 'Você encontrou! Isso vai ajudar muito. Rina vai conseguir tratar os feridos. Obrigada, de verdade.' : 'Você disse que encontrou, mas não vejo o kit médico com você.',
        choices: (ctx) => {
          if (!ctx.inventory.hasItem('medkit')) return [{ id: 'back', label: 'Vou verificar minha mochila.', action: 'close' }];
          const paid = ctx.decisions?.has('m2_paid_delivery');
          const choices = [{ id: 'give', label: 'Entregar kit médico sem pedir nada.', next: 'mission_done', action: 'complete_m2', decision: { id:'m2_helped_freely', label:'Ajudou o abrigo sem cobrar', consequence:'Refúgio do Mercado confia mais em você e oferece melhor tratamento.', state:'active' } }];
          if (!paid) choices.push({ id: 'negotiate', label: 'Pedir pagamento antes de entregar.', next: 'mission_paid', action: 'complete_m2_paid', decision: { id:'m2_paid_delivery', label:'C cobrou pagamento pelos suprimentos', consequence:'Você recebeu créditos, mas o Refúgio do Mercado ficou desconfiado.', state:'active' } });
          return choices;
        }
      },
      mission_paid: {
        text: () => '...Entendo. Em tempos assim, todos tentam sobreviver. Vou pagar, mas isso não será esquecido.',
        choices: () => [{ id: 'ok', label: 'Negócios são negócios.', action: 'close' }]
      },
      mission_done: {
        text: (ctx) => ctx.decisions?.has('m2_helped_freely')
          ? 'Com esses suprimentos, temos uma chance melhor. Você ganhou nossa confiança. Se ouvir algo pelo rádio, me avise.'
          : 'Os suprimentos vão ajudar. Ainda assim, lembrarei da sua escolha.',
        choices: (ctx) => [{ id: 'ok', label: ctx.decisions?.has('m2_helped_freely') ? 'Estamos juntos.' : 'Entendido.', action: 'close', trust: ctx.decisions?.has('m2_helped_freely') ? 1 : 0 }]
      },
      trust_info: {
        text: () => 'O sinal que você ativou no transmissor... não foi só ruído. Alguém respondeu com um código curto. Pode ser outro grupo de sobreviventes ao norte.',
        choices: () => [{ id: 'ok', label: 'Vou investigar quando puder.', action: 'close' }]
      }
    }
  },
  {
    id: 'npc_leo',
    name: 'Leo',
    role: 'Batedor',
    personality: 'alerta e direto',
    position: { x: 31, y: 0.18, z: 30 },
    color: 0x7a8a6a,
    routine: [
      { type: 'walk', pos: { x: 33, z: 28 }, dur: 4 },
      { type: 'idle', pos: { x: 33, z: 28 }, dur: 3 },
      { type: 'walk', pos: { x: 31, z: 33 }, dur: 4 },
      { type: 'idle', pos: { x: 31, z: 33 }, dur: 4 },
      { type: 'walk', pos: { x: 29, z: 30 }, dur: 3 },
      { type: 'idle', pos: { x: 29, z: 30 }, dur: 3 },
    ],
    dialogs: {
      start: {
        text: (ctx) => ctx.flags.met_leo
          ? 'Ruas calmas por enquanto. Mas "calmo" aqui não dura muito.'
          : 'Pare aí. ...Ok, você parece humano. Sou Leo, batedor do abrigo. Fico de olho nas ruas.',
        choices: (ctx) => {
          const c = [];
          if (!ctx.flags.met_leo) c.push({ id:'intro', label:'Você patrulha sozinho?', next:'intro' });
          c.push({ id:'tips', label:'Alguma dica de sobrevivência?', next:'tips' });
          c.push({ id:'danger', label:'Viu algo perigoso?', next:'danger' });
          c.push({ id:'trade', label:'Quero negociar.', action:'trade' });
          c.push({ id:'bye', label:'Vou continuar.', action:'close' });
          return c;
        }
      },
      intro: {
        text: () => 'Alguém tem que fazer isso. Conheço os becos e os pontos onde os mortos se juntam. Se for sair, evite correr sem motivo — faz barulho e cansa.',
        choices: () => [{ id:'back', label:'Valeu, Leo.', next:'start', action:'set_flag', flag:'met_leo', trust:1 }]
      },
      tips: {
        text: () => 'Mantenha fome, sede e energia sob controle. Comida e água estão em caixas, armários e prédios. E descanse só em lugares seguros.',
        choices: () => [{ id:'ok', label:'Anotado.', action:'close' }]
      },
      danger: {
        text: () => 'Os zumbis estão mais ativos perto de ruas abertas. Se ouvir passos pesados, prepare-se. E cuidado com tempestades — a visibilidade cai rápido.',
        choices: () => [{ id:'ok', label:'Vou tomar cuidado.', action:'close' }]
      }
    }
  },
  {
    id: 'npc_rina',
    name: 'Rina',
    role: 'Médica',
    personality: 'gentil e cansada',
    position: { x: 25, y: 0.18, z: 29 },
    color: 0xb07a8a,
    routine: [
      { type: 'idle', pos: { x: 25, z: 29 }, dur: 5 },
      { type: 'walk', pos: { x: 26, z: 27 }, dur: 3 },
      { type: 'idle', pos: { x: 26, z: 27 }, dur: 5 },
      { type: 'walk', pos: { x: 25, z: 29 }, dur: 3 },
    ],
    dialogs: {
      start: {
        text: (ctx) => {
          if (ctx.decisions?.has('m2_paid_delivery')) return 'Oi... ouvi que você cobrou pelos suprimentos. Eu entendo a necessidade, mas aqui as pessoas estavam feridas.';
          if (ctx.decisions?.has('m2_helped_freely')) return 'Oi. Obrigada pelo que você fez pelo abrigo. Aqueles suprimentos salvaram vidas.';
          return ctx.flags.met_rina
            ? 'Oi. Ainda estou cuidando dos feridos. Se tiver bandagens ou kits, eles fazem diferença.'
            : 'Olá... eu sou Rina. Tento manter todos vivos aqui, mas os recursos médicos são poucos.';
        },
        choices: (ctx) => {
          const c = [];
          if (!ctx.flags.met_rina) c.push({ id:'intro', label:'Você é médica?', next:'intro' });
          c.push({ id:'heal', label:'Como posso me cuidar melhor?', next:'heal' });
          c.push({ id:'trade', label:'Preciso de suprimentos. Vamos negociar.', action:'trade' });
          c.push({ id:'bye', label:'Boa sorte, Rina.', action:'close' });
          return c;
        }
      },
      intro: {
        text: () => 'Era enfermeira antes de tudo isso. Agora faço o que dá. Bandagens ajudam, mas kits médicos são o que realmente salvam.',
        choices: () => [{ id:'back', label:'Vou ajudar quando puder.', next:'start', action:'set_flag', flag:'met_rina', trust:1 }]
      },
      heal: {
        text: () => 'Não ignore ferimentos. Use bandagens ou kits quando puder. Comer e beber também ajuda o corpo a aguentar. E descanse em abrigos seguros.',
        choices: () => [{ id:'ok', label:'Obrigado pelo cuidado.', action:'close' }]
      }
    }
  },
  {
    id: 'npc_jonas',
    name: 'Jonas',
    role: 'Sentinela da Ferrovia',
    personality: 'disciplinado e desconfiado',
    factionId: 'sentinelas_ferrovia',
    position: { x: -10, y: 0.18, z: 90 },
    color: 0x8a7a5a,
    routine: [
      { type: 'idle', pos: { x: -10, z: 90 }, dur: 4 },
      { type: 'walk', pos: { x: -12, z: 92 }, dur: 3 },
      { type: 'idle', pos: { x: -12, z: 92 }, dur: 4 },
      { type: 'walk', pos: { x: -8, z: 89 }, dur: 3 },
      { type: 'idle', pos: { x: -8, z: 89 }, dur: 3 },
      { type: 'walk', pos: { x: -10, z: 90 }, dur: 3 },
    ],
    dialogs: {
      start: {
        text: (ctx) => {
          const st = ctx.factions?.getStatus('sentinelas_ferrovia') || 'neutro';
          if (st === 'hostil') return 'Você não é bem-vindo aqui. Dê meia-volta antes que eu mude de ideia.';
          if (ctx.decisions?.has('m3_completed')) return 'Você provou valor na rota sul. Os Sentinelas têm respeito por isso.';
          if (ctx.flags.met_jonas) return 'A ferrovia ainda está de pé. É mais do que a maioria dos lugares pode dizer.';
          return 'Alto. Eu sou Jonas, dos Sentinelas da Ferrovia. Controlamos as passagens do metrô. Fale rápido.';
        },
        choices: (ctx) => {
          const st = ctx.factions?.getStatus('sentinelas_ferrovia') || 'neutro';
          if (st === 'hostil') return [{ id:'bye', label:'Estou indo.', action:'close' }];
          const c = [];
          if (!ctx.flags.met_jonas) c.push({ id:'intro', label:'Quem são os Sentinelas?', next:'intro' });
          c.push({ id:'work', label:'Precisa de ajuda?', next:'mission_offer' });
          if (ctx.missions.getMission('m3_rota_segura')?.state === 'active') c.push({ id:'m3_hint', label:'Sobre a rota segura...', next:'m3_hint' });
          if (ctx.factions?.canTrade('sentinelas_ferrovia')) c.push({ id:'trade', label:'Quero negociar.', action:'trade' });
          c.push({ id:'bye', label:'Até mais.', action:'close' });
          return c;
        }
      },
      intro: {
        text: () => 'Mantemos os túneis e rotas vigiadas. Não confiamos fácil, mas respeitamos quem prova valor. Ajude e terá acesso; crie problema e será tratado como ameaça.',
        choices: () => [{ id:'back', label:'Entendido.', next:'start', action:'set_flag', flag:'met_jonas', trust:1, factionRep:{faction:'sentinelas_ferrovia', amount:5} }]
      },
      mission_offer: {
        text: (ctx) => ctx.missions.getMission('m3_rota_segura')?.state === 'completed'
          ? 'Você já limpou a rota. Os Sentinelas lembram disso.'
          : 'Há um ponto de risco perto da estação. Limpe a ameaça e marque a rota para nós. Em troca, terá nossa confiança.',
        choices: (ctx) => {
          const m = ctx.missions.getMission('m3_rota_segura');
          if (m?.state === 'completed') return [{id:'ok', label:'Bom saber.', action:'close'}];
          if (m?.state === 'active') return [{id:'ok', label:'Estou cuidando disso.', action:'close'}];
          return [
            { id:'accept', label:'Vou cuidar da rota.', next:'mission_accept', action:'accept_m3' },
            { id:'refuse', label:'Não agora.', next:'start', action:'faction_rep', faction:'sentinelas_ferrovia', amount:-2, decision:{id:'m3_refused', label:'Recusou ajudar os Sentinelas inicialmente', consequence:'Sentinelas ficaram menos confiantes.', state:'active'} }
          ];
        }
      },
      mission_accept: {
        text: () => 'Bom. Vá até o ponto marcado perto da estação e elimine a ameaça. Volte inteiro.',
        choices: () => [{ id:'ok', label:'Entendido.', action:'close' }]
      },
      m3_hint: {
        text: () => 'A ameaça está perto da entrada da estação sul. Cuidado com emboscadas e não faça barulho demais.',
        choices: () => [{ id:'ok', label:'Valeu.', action:'close' }]
      }
    }
  },
  {
    id: 'npc_tess',
    name: 'Tess',
    role: 'Mecânica dos Catadores',
    personality: 'pragmática e esperta',
    factionId: 'catadores',
    position: { x: -74, y: 0.18, z: 10 },
    color: 0x7a8a5e,
    routine: [
      { type: 'idle', pos: { x: -74, z: 10 }, dur: 4 },
      { type: 'walk', pos: { x: -76, z: 12 }, dur: 3 },
      { type: 'idle', pos: { x: -76, z: 12 }, dur: 4 },
      { type: 'walk', pos: { x: -72, z: 8 }, dur: 3 },
      { type: 'idle', pos: { x: -72, z: 8 }, dur: 3 },
      { type: 'walk', pos: { x: -74, z: 10 }, dur: 3 },
    ],
    dialogs: {
      start: {
        text: (ctx) => {
          const st = ctx.factions?.getStatus('catadores') || 'neutro';
          if (st === 'hostil') return 'Você mexeu com os Catadores. Não espere preços bons nem ajuda aqui.';
          if (ctx.decisions?.has('m4_completed')) return 'Olha só, a mão que manteve a oficina viva. O que precisa hoje?';
          if (ctx.flags.met_tess) return 'Tem sucata, peças ou história boa? Se não, pelo menos não atrapalhe a oficina.';
          return 'Ei, cuidado com as peças! Sou Tess, dos Catadores. Se tem algo útil, a gente conversa.';
        },
        choices: (ctx) => {
          const st = ctx.factions?.getStatus('catadores') || 'neutro';
          if (st === 'hostil') return [{ id:'bye', label:'Vou embora.', action:'close' }];
          const c = [];
          if (!ctx.flags.met_tess) c.push({ id:'intro', label:'O que os Catadores fazem?', next:'intro' });
          c.push({ id:'work', label:'Posso ajudar em algo?', next:'mission_offer' });
          if (ctx.missions.getMission('m4_pecas_criticas')?.state === 'active') c.push({ id:'m4_hint', label:'Sobre as peças...', next:'m4_hint' });
          if (ctx.factions?.canTrade('catadores')) c.push({ id:'trade', label:'Quero negociar.', action:'trade' });
          c.push({ id:'bye', label:'Falou.', action:'close' });
          return c;
        }
      },
      intro: {
        text: () => 'A gente desmonta, conserta e troca. Nada é lixo até eu dizer que é lixo. Traga peças e a gente se dá bem.',
        choices: () => [{ id:'back', label:'Boa filosofia.', next:'start', action:'set_flag', flag:'met_tess', trust:1, factionRep:{faction:'catadores', amount:5} }]
      },
      mission_offer: {
        text: (ctx) => ctx.missions.getMission('m4_pecas_criticas')?.state === 'completed'
          ? 'Aquelas peças salvaram nossa oficina. Você tem crédito com os Catadores.'
          : 'Estou precisando de componentes mecânicos para manter a oficina viva. Traga 2 peças mecânicas e eu faço valer a pena.',
        choices: (ctx) => {
          const m = ctx.missions.getMission('m4_pecas_criticas');
          if (m?.state === 'completed') return [{id:'ok', label:'Fechado.', action:'close'}];
          if (m?.state === 'active') {
            const has = (ctx.inventory.getCount?.('mechanical_parts') || 0) >= 2;
            return has
              ? [{id:'deliver', label:'Entregar 2 peças mecânicas.', next:'mission_done', action:'complete_m4'}]
              : [{id:'ok', label:'Ainda estou procurando.', action:'close'}];
          }
          return [
            { id:'accept', label:'Vou conseguir as peças.', next:'mission_accept', action:'accept_m4' },
            { id:'refuse', label:'Agora não.', next:'start', decision:{id:'m4_refused', label:'Recusou ajudar os Catadores inicialmente', consequence:'Tess anotou sua recusa, mas a missão segue disponível.', state:'active'} }
          ];
        }
      },
      mission_accept: {
        text: () => 'Ótimo. Peças mecânicas: carros abandonados, gavetas, caixas. Volte quando tiver duas.',
        choices: () => [{ id:'ok', label:'Pode deixar.', action:'close' }]
      },
      mission_done: {
        text: () => 'Perfeito! Com isso a oficina respira mais um pouco. Pegue sua recompensa e considere-se amigo dos Catadores.',
        choices: () => [{ id:'ok', label:'Bom negócio.', action:'close' }]
      },
      m4_hint: {
        text: () => 'Veículos abandonados e caixas de peças costumam ter o que eu preciso. Não volte de mãos vazias.',
        choices: () => [{ id:'ok', label:'Entendi.', action:'close' }]
      }
    }
  }
];
