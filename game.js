const partyTemplate = [
  { id: 'kael', name: 'Kael', role: 'Tideguard', mark: 'K', color: '#d8b977', hair: '#554a37', hp: 136, maxHp: 136, mp: 18, maxMp: 18, power: 32, magic: 0, defense: 12, speed: 78, skill: { name: 'Undertow', detail: 'Heavy strike · delays target', cost: 6, type: 'damage', multiplier: 1.75, delay: 1.25, pierce: 0 } },
  { id: 'ilea', name: 'Ilea', role: 'Tidecaller', mark: 'I', color: '#89c6c1', hair: '#324c55', hp: 92, maxHp: 92, mp: 34, maxMp: 34, power: 16, magic: 29, defense: 7, speed: 104, skill: { name: 'Mend', detail: 'Restore an ally · 40% HP', cost: 7, type: 'heal', multiplier: .4, delay: 1.1 } },
  { id: 'ren', name: 'Ren', role: 'Wayfinder', mark: 'R', color: '#cb927c', hair: '#503d3c', hp: 106, maxHp: 106, mp: 22, maxMp: 22, power: 27, magic: 0, defense: 9, speed: 91, skill: { name: 'Riftshot', detail: 'Piercing shot · ignores armor', cost: 5, type: 'damage', multiplier: 1.4, delay: .92, pierce: 1 } },
];

const enemyTemplate = { id: 'brinebound', name: 'Brinebound', epithet: 'A hunger from the shelf', hp: 360, maxHp: 360, power: 29, defense: 13, speed: 72 };
const $ = (id) => document.getElementById(id);
const titleScreen = $('titleScreen');
const battleScreen = $('battleScreen');
const endingScreen = $('endingScreen');
const combatants = $('combatants');
const commandContent = $('commandContent');
let state;
let logCount = 0;
let soundEnabled = false;
let audioContext;

function newGame() {
  state = {
    party: structuredClone(partyTemplate), enemy: structuredClone(enemyTemplate),
    items: { potion: 3, ether: 1 }, timeline: [], clock: 0, activeId: null,
    menu: 'root', pendingAction: null, log: 'A Brinebound rises from the shallows.', over: false,
  };
  logCount = 1;
  state.party.forEach((unit) => schedule(unit, 1000 / unit.speed));
  schedule(state.enemy, 1000 / state.enemy.speed);
  titleScreen.classList.add('is-hidden');
  endingScreen.classList.add('is-hidden');
  battleScreen.classList.remove('is-hidden');
  render();
  takeNextTurn();
}

function schedule(unit, delay = 1000 / unit.speed) {
  state.timeline.push({ id: unit.id, at: state.clock + delay });
  state.timeline.sort((a, b) => a.at - b.at);
}

function aliveParty() { return state.party.filter((unit) => unit.hp > 0); }
function unitById(id) { return id === state.enemy.id ? state.enemy : state.party.find((unit) => unit.id === id); }

function takeNextTurn() {
  if (state.over) return;
  let next;
  do {
    next = state.timeline.shift();
    if (!next) return finish(false);
  } while (!unitById(next.id) || unitById(next.id).hp <= 0);
  state.clock = next.at;
  const actor = unitById(next.id);
  state.activeId = actor.id;
  state.menu = 'root';
  state.pendingAction = null;
  render();
  if (actor.id === state.enemy.id) {
    window.setTimeout(enemyTurn, 470);
  } else {
    announce(`${actor.name}'s turn.`);
  }
}

function enemyTurn() {
  if (!state || state.over || state.activeId !== state.enemy.id) return;
  const targets = aliveParty().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const target = targets[0];
  const damage = Math.max(5, Math.round((state.enemy.power - target.defense + randomInt(0, 6)) * (target.guarding ? .5 : 1)));
  target.hp = Math.max(0, target.hp - damage);
  target.guarding = false;
  setLog(`${state.enemy.name} lashes ${target.name} for ${damage} damage.`);
  if (target.hp <= 0) setLog(`${target.name} falls, but the others hold the line.`);
  if (aliveParty().length === 0) {
    render();
    floatNumber(target.id, damage, false);
    window.setTimeout(() => finish(false), 650);
    return;
  }
  schedule(state.enemy, 1000 / state.enemy.speed);
  render();
  floatNumber(target.id, damage, false);
  window.setTimeout(takeNextTurn, 430);
}

function chooseRoot(action) {
  if (!canAct()) return;
  if (action === 'strike') {
    performStrike();
  } else if (action === 'technique') {
    state.menu = 'technique';
    render();
  } else if (action === 'item') {
    state.menu = 'item';
    render();
  } else if (action === 'guard') {
    const actor = unitById(state.activeId);
    actor.guarding = true;
    setLog(`${actor.name} takes a guarded stance. Their next hit is halved.`);
    spendTurn(actor, .72);
  }
}

function canAct() { return state && !state.over && state.activeId && state.activeId !== state.enemy.id; }

function performStrike() {
  const actor = unitById(state.activeId);
  const damage = Math.max(1, actor.power + randomInt(-2, 5) - state.enemy.defense);
  hitEnemy(actor, damage, `${actor.name} strikes for ${damage} damage.`, 1);
}

function showSkill(skill) {
  const actor = unitById(state.activeId);
  if (actor.mp < skill.cost) return;
  state.pendingAction = { ...skill, source: actor.id };
  if (skill.type === 'heal') {
    state.menu = 'target-ally';
  } else {
    executeSkill(state.enemy.id);
    return;
  }
  render();
}

function executeSkill(targetId) {
  const actor = unitById(state.activeId);
  const skill = state.pendingAction;
  if (!skill || actor.mp < skill.cost) return;
  if (skill.type === 'heal' && unitById(targetId).hp === unitById(targetId).maxHp) {
    setLog(`${unitById(targetId).name} is already at full health.`);
    render();
    return;
  }
  actor.mp -= skill.cost;
  if (skill.type === 'heal') {
    const target = unitById(targetId);
    const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * skill.multiplier));
    target.hp += amount;
    setLog(`${actor.name} casts Mend. ${target.name} recovers ${amount} HP.`);
    spendTurn(actor, skill.delay);
    floatNumber(target.id, amount, true);
  } else {
    const defense = Math.round(state.enemy.defense * (1 - (skill.pierce || 0)));
    const damage = Math.max(1, Math.round(actor.power * skill.multiplier) + randomInt(0, 5) - defense);
    const suffix = skill.pierce ? ' Armor means nothing to this shot.' : ' The current pulls it off balance.';
    hitEnemy(actor, damage, `${actor.name} uses ${skill.name} for ${damage} damage.${suffix}`, skill.delay);
  }
}

function useItem(item) {
  if (!canAct() || state.items[item] <= 0) return;
  state.pendingAction = { type: item };
  state.menu = 'target-ally';
  render();
}

function chooseAlly(targetId) {
  if (!canAct() || state.menu !== 'target-ally') return;
  const actor = unitById(state.activeId);
  const target = unitById(targetId);
  if (!target || target.hp <= 0) return;
  const action = state.pendingAction;
  let recovered = 0;
  if (action.type === 'heal') {
    executeSkill(targetId);
    return;
  }
  if (action.type === 'potion') {
    const amount = Math.min(target.maxHp - target.hp, 62);
    if (amount <= 0) { setLog(`${target.name} is already at full health.`); render(); return; }
    state.items.potion -= 1;
    target.hp += amount;
    recovered = amount;
    setLog(`${actor.name} gives ${target.name} a Saltbloom draught. ${amount} HP restored.`);
  } else if (action.type === 'ether') {
    const amount = Math.min(target.maxMp - target.mp, 14);
    if (amount <= 0) { setLog(`${target.name} already has enough focus.`); render(); return; }
    state.items.ether -= 1;
    target.mp += amount;
    setLog(`${actor.name} shares a blueglass tonic. ${target.name} recovers ${amount} MP.`);
  }
  spendTurn(actor, 1.05);
  if (action.type === 'potion') floatNumber(target.id, recovered, true);
  if (action.type === 'potion') floatNumber(target.id, 62, true);
}

function hitEnemy(actor, damage, message, delay) {
  state.enemy.hp = Math.max(0, state.enemy.hp - damage);
  setLog(message);
  if (state.enemy.hp <= 0) {
    render();
    floatNumber(state.enemy.id, damage, false);
    window.setTimeout(() => finish(true), 650);
    return;
  }
  spendTurn(actor, delay);
  floatNumber(state.enemy.id, damage, false);
}

function spendTurn(actor, multiplier = 1) {
  schedule(actor, (1000 / actor.speed) * multiplier);
  state.activeId = null;
  render();
  window.setTimeout(takeNextTurn, 380);
}

function finish(won) {
  state.over = true;
  state.activeId = null;
  battleScreen.classList.add('is-hidden');
  endingScreen.classList.remove('is-hidden');
  $('endingHeading').innerHTML = won ? 'A quiet <em>return.</em>' : 'The tide <em>takes hold.</em>';
  $('endingCopy').textContent = won
    ? 'The Brinebound breaks apart into a scatter of pale salt. Somewhere beyond the shelf, a bell answers. Your companions turn toward the sound.'
    : 'The Brinebound draws its shadow across the shallows. Your companions retreat together, carrying the last of their strength back to shore.';
  $('rewardCard').innerHTML = won
    ? '<div class="reward-item">FOUND<strong>Saltglass charm</strong></div><div class="reward-item">RECOVERED<strong>120 marks</strong></div><div class="reward-item">KEPT<strong>3 together</strong></div>'
    : '<div class="reward-item">RECOVERED<strong>A safe retreat</strong></div><div class="reward-item">KEPT<strong>The way home</strong></div>';
  $('againButton').querySelector('span:first-child').textContent = won ? 'Answer the bell' : 'Try the passage again';
  announce(won ? 'Encounter won.' : 'The party retreated.');
}

function setLog(message) {
  state.log = message;
  logCount += 1;
  $('battleLog').textContent = message;
  $('logIndex').textContent = String(logCount).padStart(2, '0');
  $('srAnnounce').textContent = message;
}

function announce(message) { $('srAnnounce').textContent = message; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function render() {
  if (!state) return;
  renderTimeline();
  renderParty();
  renderCombatants();
  renderCommand();
  $('battleLog').textContent = state.log;
  $('logIndex').textContent = String(logCount).padStart(2, '0');
}

function renderTimeline() {
  const tokens = [...state.timeline].sort((a, b) => a.at - b.at).slice(0, 7);
  if (state.activeId) tokens.unshift({ id: state.activeId, current: true });
  $('turnOrder').innerHTML = tokens.map((entry, index) => {
    const unit = unitById(entry.id);
    if (!unit) return '';
    const enemy = unit.id === state.enemy.id;
    return `${index ? '<span class="turn-separator" aria-hidden="true">›</span>' : ''}<span class="turn-token ${enemy ? 'is-enemy' : ''} ${entry.current ? 'is-current' : ''}" title="${unit.name}${entry.current ? ' · acting now' : ''}">${unit.mark || '◈'}</span>`;
  }).join('');
}

function renderParty() {
  $('partyCards').closest('.party-panel').querySelector('.party-count').textContent = `${aliveParty().length} / 3 READY`;
  $('partyCards').innerHTML = state.party.map((unit) => {
    const hpPct = Math.max(0, unit.hp / unit.maxHp * 100);
    const mpPct = Math.max(0, unit.mp / unit.maxMp * 100);
    return `<div class="party-card ${state.activeId === unit.id ? 'is-active' : ''} ${unit.hp <= 0 ? 'is-dead' : ''}" style="--unit-color:${unit.color}">
      <span class="party-crest">${unit.mark}</span><span class="party-name"><strong>${unit.name}</strong><span>${unit.role}</span></span>
      <span class="stat-bars"><span class="stat-row"><span>HP</span><span class="stat-track"><span class="stat-fill hp-fill" style="width:${hpPct}%"></span></span><span>${unit.hp}/${unit.maxHp}</span></span><span class="stat-row"><span>MP</span><span class="stat-track"><span class="stat-fill mp-fill" style="width:${mpPct}%"></span></span><span>${unit.mp}/${unit.maxMp}</span></span></span>
    </div>`;
  }).join('');
}

function renderCombatants() {
  const actor = unitById(state.activeId);
  const inactive = state.activeId && state.activeId !== state.enemy.id;
  const heroes = state.party.map((unit) => {
    const targetable = state.menu === 'target-ally' && unit.hp > 0;
    return `<div class="combatant ${state.activeId === unit.id ? 'is-acting' : ''} ${inactive && state.activeId !== unit.id ? 'is-faded' : ''} ${unit.hp <= 0 ? 'is-dead' : ''} ${targetable ? 'is-targetable' : ''}" data-ally="${unit.id}" style="--unit-color:${unit.color};--hair-color:${unit.hair}" role="${targetable ? 'button' : 'img'}" ${targetable ? `tabindex="0" aria-label="Use action on ${unit.name}, ${unit.hp} HP"` : `aria-label="${unit.name}, ${unit.hp} of ${unit.maxHp} HP"`}>
      <span class="combatant-status">${state.activeId === unit.id ? 'YOUR TURN' : 'READY'}</span><span class="combatant-figure"><i class="figure-aura"></i><i class="figure-cloak"></i><i class="figure-body"></i><i class="figure-head"></i></span><span class="combatant-mark">${unit.mark}</span><span class="combatant-name">${unit.name}</span>
    </div>`;
  }).join('');
  const foe = state.enemy;
  const foePct = Math.max(0, foe.hp / foe.maxHp * 100);
  const targetFoe = state.menu === 'target-enemy';
  const enemyMarkup = `<div class="combatant enemy-combatant ${state.activeId === foe.id ? 'is-acting' : ''} ${inactive ? 'is-faded' : ''} ${foe.hp <= 0 ? 'is-dead' : ''} ${targetFoe ? 'is-targetable' : ''}" data-enemy="${foe.id}" style="--unit-color:#99b999" role="img" aria-label="${foe.name}, ${foe.hp} of ${foe.maxHp} HP">
    <span class="combatant-status">${state.activeId === foe.id ? 'ENEMY TURN' : 'BRINE-TOUCHED'}</span><span class="enemy-figure"><i class="enemy-spike spike-two"></i><i class="enemy-spike spike-three"></i><i class="enemy-tendril tendril-one"></i><i class="enemy-tendril tendril-two"></i><i class="enemy-core"></i><i class="enemy-spike"></i></span>
    <span class="enemy-label"><strong>${foe.name}</strong><span>${foe.epithet}</span><span class="enemy-health"><span class="enemy-health-fill" style="display:block;width:${foePct}%"></span></span></span>
  </div>`;
  combatants.innerHTML = heroes + enemyMarkup;
  combatants.querySelectorAll('[data-ally]').forEach((el) => {
    el.addEventListener('click', () => chooseAlly(el.dataset.ally));
    el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseAlly(el.dataset.ally); } });
  });
  const heading = $('actorHeading');
  if (!actor || actor.id === state.enemy.id) {
    heading.innerHTML = `<span>${actor?.id === state.enemy.id ? 'BRINEBOUND IS MOVING' : 'THE CURRENT MOVES'}</span><span>${actor?.id === state.enemy.id ? 'Choose your next response' : 'Calculating turn order'}</span>`;
  } else {
    heading.innerHTML = `<span>${actor.name.toUpperCase()}’S TURN</span><span>${actor.role} · ${actor.speed} SPD</span>`;
  }
}

function button(label, action, detail = '', key = '', disabled = false, extra = '') {
  return `<button class="action-button ${extra}" type="button" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}${key ? `<kbd>${key}</kbd>` : ''}${detail ? `<span class="action-subtitle">${detail}</span>` : ''}</button>`;
}

function renderCommand() {
  const root = state.menu === 'root';
  const actor = unitById(state.activeId);
  const usable = canAct();
  if (!usable) {
    commandContent.className = 'command-content';
    commandContent.innerHTML = '<span class="command-wait">The next turn is approaching…</span>';
    return;
  }
  if (root) {
    commandContent.className = 'command-content';
    commandContent.innerHTML = [
      button('Strike', 'strike', 'Quick physical attack', '1'),
      button('Technique', 'technique', 'Unique party skill', '2'),
      button('Satchel', 'item', `Draught ×${state.items.potion} · Tonic ×${state.items.ether}`, '3'),
      button('Guard', 'guard', 'Brace · shorter recovery', '4'),
    ].join('');
  } else if (state.menu === 'technique') {
    const skill = actor.skill;
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `<button class="action-button" type="button" data-action="skill" ${actor.mp < skill.cost ? 'disabled' : ''}><span>${skill.name}<span class="action-subtitle">${skill.detail}</span></span><span class="skill-cost">${skill.cost} MP</span></button>${button('‹ Back', 'back', '', '', false, 'back-button')}`;
  } else if (state.menu === 'item') {
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `${button('Saltbloom draught', 'potion', `Restore up to 62 HP · ${state.items.potion} left`, '', state.items.potion === 0)}${button('Blueglass tonic', 'ether', `Restore up to 14 MP · ${state.items.ether} left`, '', state.items.ether === 0)}${button('‹ Back', 'back', '', '', false, 'back-button')}`;
  } else if (state.menu === 'target-ally') {
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `<span class="action-subtitle">CHOOSE A COMPANION</span>${aliveParty().map((unit) => button(`${unit.name} · ${unit.hp}/${unit.maxHp} HP`, `ally:${unit.id}`)).join('')}${button('‹ Back', 'back', '', '', false, 'back-button')}`;
  }
  commandContent.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action.startsWith('ally:')) chooseAlly(action.slice(5));
      else if (action === 'skill') showSkill(actor.skill);
      else if (action === 'potion' || action === 'ether') useItem(action);
      else if (action === 'back') { state.menu = 'root'; state.pendingAction = null; render(); }
      else chooseRoot(action);
    });
  });
}

function floatNumber(targetId, amount, healing) {
  const selector = targetId === state.enemy.id ? '.enemy-combatant' : `[data-ally="${targetId}"]`;
  const target = combatants.querySelector(selector);
  if (!target) return;
  const number = document.createElement('span');
  number.className = `damage-number ${healing ? 'heal' : ''}`;
  number.textContent = healing ? `+${amount}` : `−${amount}`;
  target.append(number);
  window.setTimeout(() => number.remove(), 950);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  $('soundToggle').setAttribute('aria-pressed', String(soundEnabled));
  $('soundLabel').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  if (soundEnabled && (window.AudioContext || window.webkitAudioContext)) playNote(392, .14);
}

function playNote(frequency, duration) {
  if (!soundEnabled) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audioContext ||= new Context();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine'; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.025, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button && soundEnabled) playNote(button.disabled ? 180 : 330, .07);
});
$('beginJourney').addEventListener('click', newGame);
$('againButton').addEventListener('click', newGame);
$('soundToggle').addEventListener('click', toggleSound);
document.addEventListener('keydown', (event) => {
  if (event.target.closest('button, a, input, textarea, select')) return;
  if (event.key === 'Enter' && !battleScreen.classList.contains('is-hidden') && canAct() && state.menu === 'root') { chooseRoot('strike'); return; }
  if (event.key === 'Enter' && !battleScreen.classList.contains('is-hidden') && state.menu === 'target-ally') {
    const first = aliveParty()[0]; if (first) chooseAlly(first.id); return;
  }
  if (event.key === 'Enter' && !titleScreen.classList.contains('is-hidden')) { newGame(); return; }
  if (event.key === 'Escape' && state && !state.over && canAct() && state.menu !== 'root') { state.menu = 'root'; state.pendingAction = null; render(); return; }
  if (/^[1-4]$/.test(event.key) && canAct() && state.menu === 'root') chooseRoot(['', 'strike', 'technique', 'item', 'guard'][Number(event.key)]);
});
