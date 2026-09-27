(() => {
  const STORAGE_KEY = 'tidebound-current-weave-v1';
  const starters = { kael: '2-0', ilea: '4-3', ren: '2-6' };
  const specialties = {
    '1-1': { type: 'art', label: 'Breakwater', owner: 'kael', reward: { skill: { id: 'breakwater', name: 'Breakwater', detail: 'A crushing blow · high stagger', cost: 8, type: 'damage', multiplier: 2.1, delay: 1.3, pierce: 0 } } },
    '3-3': { type: 'art', label: 'Ringing Tide', owner: 'ilea', reward: { skill: { id: 'ringing-tide', name: 'Ringing Tide', detail: 'Mend every companion · 24% HP', cost: 13, type: 'party-heal', multiplier: .24, delay: 1.25 } } },
    '1-5': { type: 'art', label: 'Far Horizon', owner: 'ren', reward: { skill: { id: 'far-horizon', name: 'Far Horizon', detail: 'A focused shot · ignores armor', cost: 9, type: 'damage', multiplier: 1.85, delay: 1.1, pierce: 1 } } },
    '0-3': { type: 'art', label: 'Blue Hour', owner: 'ilea', reward: { skill: { id: 'blue-hour', name: 'Blue Hour', detail: 'Restore focus to one ally', cost: 0, type: 'ether-skill', multiplier: 0, delay: .8 } } },
  };
  const rewards = [
    { type: 'heart', label: 'Vitality', mark: '♥', reward: { maxHp: 14 } },
    { type: 'edge', label: 'Strength', mark: '✦', reward: { power: 3 } },
    { type: 'focus', label: 'Focus', mark: '◇', reward: { maxMp: 5, magic: 2 } },
    { type: 'guard', label: 'Guard', mark: '⬡', reward: { defense: 2 } },
    { type: 'tempo', label: 'Tempo', mark: '⌁', reward: { speed: 4 } },
  ];

  const nodes = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const id = `${row}-${col}`;
      const special = specialties[id];
      const starterFor = Object.keys(starters).find((character) => starters[character] === id) || null;
      const regular = rewards[(row * 3 + col * 2) % rewards.length];
      nodes.push({
        id, row, col, x: 61 + col * 101 + (row % 2) * 50, y: 54 + row * 88,
        type: special ? special.type : starterFor ? 'origin' : regular.type,
        label: special ? special.label : starterFor ? `${starterFor} origin` : regular.label,
        mark: special ? '✧' : starterFor ? starterFor[0].toUpperCase() : regular.mark,
        owner: special?.owner || null,
        reward: special ? special.reward : starterFor ? {} : regular.reward,
        starterFor,
      });
    }
  }
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const edges = [];
  for (const node of nodes) {
    const cross = node.row % 2 === 0 ? [node.col - 1, node.col] : [node.col, node.col + 1];
    for (const [row, col] of [[node.row, node.col + 1], [node.row + 1, cross[0]], [node.row + 1, cross[1]]]) {
      const next = byId[`${row}-${col}`];
      if (next) edges.push([node.id, next.id]);
    }
  }

  function freshProfile() {
    return {
      version: 1,
      party: Object.fromEntries(Object.entries(starters).map(([id, start]) => [id, { sp: 3, nodes: [start] }])),
      victories: 0,
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw || raw.version !== 1 || !raw.party) return freshProfile();
      const fallback = freshProfile();
      for (const id of Object.keys(starters)) {
        const saved = raw.party[id];
        if (!saved || !Array.isArray(saved.nodes)) continue;
        const knownNodes = [...new Set(saved.nodes.filter((nodeId) => byId[nodeId]))];
        if (!knownNodes.includes(starters[id])) knownNodes.push(starters[id]);
        fallback.party[id] = { sp: Math.max(0, Number(saved.sp) || 0), nodes: knownNodes };
      }
      fallback.victories = Math.max(0, Number(raw.victories) || 0);
      return fallback;
    } catch {
      return freshProfile();
    }
  }

  let profile = load();
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* Storage may be unavailable for private file URLs. */ }
  }
  function character(id) { return profile.party[id]; }
  function isActive(characterId, nodeId) { return character(characterId)?.nodes.includes(nodeId) || false; }
  function isReachable(characterId, nodeId) {
    const saved = character(characterId);
    if (!saved || !byId[nodeId] || isActive(characterId, nodeId)) return false;
    const node = byId[nodeId];
    if (node.owner && node.owner !== characterId) return false;
    return edges.some(([left, right]) => (left === nodeId && saved.nodes.includes(right)) || (right === nodeId && saved.nodes.includes(left)));
  }
  function activate(characterId, nodeId) {
    const saved = character(characterId);
    if (!saved || saved.sp < 1 || !isReachable(characterId, nodeId)) return false;
    saved.sp -= 1;
    saved.nodes.push(nodeId);
    save();
    return true;
  }
  function enhance(template) {
    const saved = character(template.id);
    const unit = structuredClone(template);
    unit.skills = [structuredClone(template.skill)];
    unit.skills[0].id ||= `basic-${template.id}`;
    for (const nodeId of saved?.nodes || []) {
      const reward = byId[nodeId]?.reward;
      if (!reward) continue;
      for (const [stat, amount] of Object.entries(reward)) {
        if (stat === 'skill') {
          if (!unit.skills.some((skill) => skill.id === amount.id)) unit.skills.push(structuredClone(amount));
        } else if (stat === 'maxHp') {
          unit.maxHp += amount;
          unit.hp += amount;
        } else if (stat === 'maxMp') {
          unit.maxMp += amount;
          unit.mp += amount;
        } else {
          unit[stat] = (unit[stat] || 0) + amount;
        }
      }
    }
    return unit;
  }
  function award(points = 3) {
    for (const saved of Object.values(profile.party)) saved.sp += points;
    profile.victories += 1;
    save();
  }
  function describeNode(characterId, nodeId) {
    const node = byId[nodeId];
    if (!node) return null;
    return { ...node, active: isActive(characterId, nodeId), reachable: isReachable(characterId, nodeId), affordable: character(characterId).sp > 0 };
  }
  function svg(characterId, selectedId) {
    const savedNodes = new Set(character(characterId).nodes);
    const lines = edges.map(([leftId, rightId]) => {
      const left = byId[leftId]; const right = byId[rightId];
      const active = savedNodes.has(leftId) && savedNodes.has(rightId);
      const open = (savedNodes.has(leftId) && isReachable(characterId, rightId)) || (savedNodes.has(rightId) && isReachable(characterId, leftId));
      return `<line class="grid-link ${active ? 'is-lit' : ''} ${open ? 'is-open' : ''}" x1="${left.x}" y1="${left.y}" x2="${right.x}" y2="${right.y}" />`;
    }).join('');
    const circles = nodes.map((node) => {
      const active = savedNodes.has(node.id);
      const reachable = isReachable(characterId, node.id);
      const selected = selectedId === node.id;
      const label = node.starterFor ? `${node.starterFor} origin` : `${node.label}${node.owner ? ` · ${node.owner}'s art` : ''}`;
      const originColor = { kael: '#d8b977', ilea: '#89c6c1', ren: '#cb927c' }[node.starterFor] || 'transparent';
      return `<g class="grid-node type-${node.type} ${active ? 'is-active' : ''} ${reachable ? 'is-reachable' : ''} ${selected ? 'is-selected' : ''} ${node.starterFor ? 'is-origin' : ''}" style="--unit-color:${originColor}" data-node="${node.id}" role="button" tabindex="0" aria-label="${label}${active ? ', attuned' : reachable ? ', available' : ', path not connected'}" transform="translate(${node.x} ${node.y})"><circle class="node-halo" r="25"/><circle class="node-orb" r="16"/><text class="node-mark" text-anchor="middle" y="4">${node.mark}</text>${node.starterFor ? `<text class="node-caption" text-anchor="middle" y="34">${node.starterFor.toUpperCase()}</text>` : ''}</g>`;
    }).join('');
    return `${lines}${circles}`;
  }

  window.Tidewheel = { nodes, byId, edges, starters, get profile() { return profile; }, character, isActive, isReachable, activate, enhance, award, describeNode, svg };
})();
