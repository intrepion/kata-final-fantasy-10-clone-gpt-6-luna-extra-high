const partyTemplate = [
  { id: 'kael', name: 'Kael', role: 'Tideguard', mark: 'K', color: '#d8b977', hair: '#554a37', hp: 136, maxHp: 136, mp: 18, maxMp: 18, power: 32, magic: 0, defense: 12, speed: 78, skill: { id: 'undertow', name: 'Undertow', detail: 'Heavy strike · delays target', cost: 6, type: 'damage', multiplier: 1.75, delay: 1.25, pierce: 0 } },
  { id: 'ilea', name: 'Ilea', role: 'Tidecaller', mark: 'I', color: '#89c6c1', hair: '#324c55', hp: 92, maxHp: 92, mp: 34, maxMp: 34, power: 16, magic: 29, defense: 7, speed: 104, skill: { id: 'mend', name: 'Mend', detail: 'Restore an ally · 40% HP', cost: 7, type: 'heal', multiplier: .4, delay: 1.1 } },
  { id: 'ren', name: 'Ren', role: 'Wayfinder', mark: 'R', color: '#cb927c', hair: '#503d3c', hp: 106, maxHp: 106, mp: 22, maxMp: 22, power: 27, magic: 0, defense: 9, speed: 91, skill: { id: 'riftshot', name: 'Riftshot', detail: 'Piercing shot · ignores armor', cost: 5, type: 'damage', multiplier: 1.4, delay: .92, pierce: 1 } },
];
const enemyTemplate = { id: 'brinebound', name: 'Brinebound', epithet: 'A hunger from the shelf', hp: 360, maxHp: 360, power: 29, defense: 13, speed: 72 };
const $ = (id) => document.getElementById(id);
const titleScreen = $('titleScreen');
const battleScreen = $('battleScreen');
const endingScreen = $('endingScreen');
const battlefield = $('battlefield');
const worldCanvas = $('worldCanvas');
const commandContent = $('commandContent');
const sphereOverlay = $('sphereOverlay');
const unitById = (id) => id === state?.enemy?.id ? state.enemy : state?.party.find((unit) => unit.id === id);
let state = null;
let logCount = 0;
let soundEnabled = false;
let audioContext;
let dialogue = null;
let dialogueTimer = null;
let sphereReturn = 'title';
let selectedGridCharacter = 'kael';
let selectedGridNode = null;
const world = new TideScene(worldCanvas);

function aliveParty() { return state.party.filter((unit) => unit.hp > 0); }

function newGame() {
  const party = partyTemplate.map((unit) => Tidewheel.enhance(unit));
  const victories = Tidewheel.profile.victories;
  const enemy = structuredClone(enemyTemplate);
  enemy.maxHp += victories * 32;
  enemy.hp = enemy.maxHp;
  enemy.power += victories * 2;
  state = {
    party, enemy, items: { potion: 3, ether: 1 }, timeline: [], clock: 0, activeId: null,
    menu: 'root', pendingAction: null, log: 'The water withdraws. Something answers below.', over: false,
    dialogueActive: false, encounter: victories + 1,
  };
  logCount = 1;
  state.party.forEach((unit) => schedule(unit, 1000 / unit.speed));
  schedule(state.enemy, 1000 / state.enemy.speed);
  titleScreen.classList.add('is-hidden');
  endingScreen.classList.add('is-hidden');
  battleScreen.classList.remove('is-hidden');
  battlefield.prepend(worldCanvas);
  worldCanvas.setAttribute('aria-label', 'Three-dimensional turn-based battle on the Salt March');
  world.setMode('battle');
  world.setFocus(null);
  $('battleHeading').textContent = state.encounter === 1 ? 'Salt-worn passage' : `The bell shelf · ${String(state.encounter).padStart(2, '0')}`;
  $('encounterLabel').textContent = `ENCOUNTER ${String(state.encounter).padStart(2, '0')}`;
  setLog('The water withdraws. Something answers below.');
  render();
  runDialogue([
    { speaker: 'ilea', text: 'The bells are under our feet. The whole shelf is humming.' },
    { speaker: 'kael', text: 'Then stay close. We find the hand ringing them.' },
    { speaker: 'ren', text: 'That is the part I dislike. It sounds like it heard you.' },
  ], takeNextTurn);
}

function schedule(unit, delay = 1000 / unit.speed) {
  state.timeline.push({ id: unit.id, at: state.clock + delay });
  state.timeline.sort((a, b) => a.at - b.at);
}

function takeNextTurn() {
  if (state.over || state.dialogueActive) return;
  let next;
  do {
    next = state.timeline.shift();
    if (!next) { finish(false); return; }
  } while (!unitById(next.id) || unitById(next.id).hp <= 0);
  state.clock = next.at;
  const actor = unitById(next.id);
  state.activeId = actor.id;
  state.menu = 'root';
  state.pendingAction = null;
  render();
  if (actor.id === state.enemy.id) window.setTimeout(enemyTurn, 480);
  else announce(`${actor.name}'s turn.`);
}

function enemyTurn() {
  if (!state || state.over || state.activeId !== state.enemy.id) return;
  const targets = aliveParty().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const target = targets[0];
  if (!target) { finish(false); return; }
  const damage = Math.max(5, Math.round((state.enemy.power - target.defense + randomInt(0, 6)) * (target.guarding ? .5 : 1)));
  target.hp = Math.max(0, target.hp - damage);
  target.guarding = false;
  world.animate(state.enemy.id, target.id, 'enemy');
  setLog(target.hp <= 0 ? `${target.name} falls, but the others hold the line.` : `${state.enemy.name} lashes ${target.name} for ${damage} damage.`);
  if (aliveParty().length === 0) {
    render();
    floatNumber(target.id, damage, false);
    window.setTimeout(() => finish(false), 690);
    return;
  }
  schedule(state.enemy, 1000 / state.enemy.speed);
  render();
  floatNumber(target.id, damage, false);
  window.setTimeout(takeNextTurn, 470);
}

function canAct() { return !!(state && !state.over && !state.dialogueActive && state.activeId && state.activeId !== state.enemy.id); }

function chooseRoot(action) {
  if (!canAct()) return;
  if (action === 'strike') performStrike();
  else if (action === 'technique') { state.menu = 'technique'; render(); }
  else if (action === 'item') { state.menu = 'item'; render(); }
  else if (action === 'guard') {
    const actor = unitById(state.activeId);
    actor.guarding = true;
    world.animate(actor.id, actor.id, 'guard');
    setLog(`${actor.name} sets their feet. The next blow will lose half its force.`);
    spendTurn(actor, .72);
  }
}

function performStrike() {
  const actor = unitById(state.activeId);
  const damage = Math.max(1, actor.power + randomInt(-2, 5) - state.enemy.defense);
  world.animate(actor.id, state.enemy.id, 'strike');
  hitEnemy(actor, damage, `${actor.name} strikes for ${damage} damage.`, 1);
}

function showSkill(skill) {
  const actor = unitById(state.activeId);
  if (actor.mp < skill.cost) return;
  state.pendingAction = { kind: 'skill', skill, source: actor.id };
  if (skill.type === 'heal' || skill.type === 'ether-skill') {
    state.menu = 'target-ally';
    render();
    return;
  }
  executeSkill(state.enemy.id);
}

function executeSkill(targetId) {
  const actor = unitById(state.activeId);
  const pending = state.pendingAction;
  const skill = pending?.skill;
  if (!skill || actor.mp < skill.cost) return;
  if (skill.type === 'heal' && unitById(targetId).hp === unitById(targetId).maxHp) {
    setLog(`${unitById(targetId).name} is already at full health.`); render(); return;
  }
  if (skill.type === 'ether-skill' && unitById(targetId).mp === unitById(targetId).maxMp) {
    setLog(`${unitById(targetId).name} already has full focus.`); render(); return;
  }
  actor.mp -= skill.cost;
  if (skill.type === 'heal') {
    const target = unitById(targetId);
    const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * skill.multiplier + actor.magic * .35));
    target.hp += amount;
    world.animate(actor.id, target.id, 'heal');
    setLog(`${actor.name} casts ${skill.name}. ${target.name} recovers ${amount} HP.`);
    spendTurn(actor, skill.delay);
    floatNumber(target.id, amount, true);
    return;
  }
  if (skill.type === 'ether-skill') {
    const target = unitById(targetId); const amount = Math.min(target.maxMp - target.mp, 15 + Math.round(actor.magic * .2));
    target.mp += amount; world.animate(actor.id, target.id, 'heal');
    setLog(`${actor.name} calls the Blue Hour. ${target.name} recovers ${amount} MP.`);
    spendTurn(actor, skill.delay); floatNumber(target.id, amount, true); return;
  }
  if (skill.type === 'party-heal') {
    const recoveries = aliveParty().map((target) => {
      const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * skill.multiplier + actor.magic * .35));
      target.hp += amount; if (amount) floatNumber(target.id, amount, true); return `${target.name} +${amount}`;
    });
    world.animate(actor.id, actor.id, 'heal');
    setLog(`${actor.name} rings ${skill.name}: ${recoveries.join(' · ')}.`);
    spendTurn(actor, skill.delay); return;
  }
  const defense = Math.round(state.enemy.defense * (1 - (skill.pierce || 0)));
  const damage = Math.max(1, Math.round(actor.power * skill.multiplier) + randomInt(0, 5) - defense);
  world.animate(actor.id, state.enemy.id, 'strike');
  const suffix = skill.pierce ? ' The shot slips through its shell.' : ' The current pulls it off balance.';
  hitEnemy(actor, damage, `${actor.name} uses ${skill.name} for ${damage} damage.${suffix}`, skill.delay);
}

function useItem(item) {
  if (!canAct() || state.items[item] <= 0) return;
  state.pendingAction = { kind: 'item', item };
  state.menu = 'target-ally';
  render();
}

function chooseAlly(targetId) {
  if (!canAct() || state.menu !== 'target-ally') return;
  const actor = unitById(state.activeId); const target = unitById(targetId);
  if (!target || target.hp <= 0) return;
  const pending = state.pendingAction;
  if (pending.kind === 'skill') { executeSkill(targetId); return; }
  if (pending.item === 'potion') {
    const amount = Math.min(target.maxHp - target.hp, 62);
    if (amount <= 0) { setLog(`${target.name} is already at full health.`); render(); return; }
    state.items.potion -= 1; target.hp += amount;
    setLog(`${actor.name} gives ${target.name} a Saltbloom draught. ${amount} HP restored.`);
    spendTurn(actor, 1.05); floatNumber(target.id, amount, true); return;
  }
  if (pending.item === 'ether') {
    const amount = Math.min(target.maxMp - target.mp, 14);
    if (amount <= 0) { setLog(`${target.name} already has enough focus.`); render(); return; }
    state.items.ether -= 1; target.mp += amount;
    setLog(`${actor.name} shares a blueglass tonic. ${target.name} recovers ${amount} MP.`);
    spendTurn(actor, 1.05); floatNumber(target.id, amount, true);
  }
}

function hitEnemy(actor, damage, message, delay) {
  state.enemy.hp = Math.max(0, state.enemy.hp - damage);
  setLog(message);
  if (state.enemy.hp <= 0) {
    render(); floatNumber(state.enemy.id, damage, false);
    window.setTimeout(() => finish(true), 690); return;
  }
  spendTurn(actor, delay); floatNumber(state.enemy.id, damage, false);
}

function spendTurn(actor, multiplier = 1) {
  state.pendingAction = null;
  schedule(actor, (1000 / actor.speed) * multiplier);
  state.activeId = null;
  render();
  window.setTimeout(takeNextTurn, 400);
}

function render() {
  if (!state) return;
  renderTimeline();
  renderParty();
  renderCommand();
  $('battleLog').textContent = state.log;
  $('logIndex').textContent = String(logCount).padStart(2, '0');
  const fill = $('enemyHpFill');
  fill.style.width = `${Math.max(0, state.enemy.hp / state.enemy.maxHp * 100)}%`;
  fill.parentElement.setAttribute('aria-label', `${state.enemy.hp} of ${state.enemy.maxHp} HP`);
  world.setState(state.party, state.enemy, state.activeId);
  const actor = unitById(state.activeId);
  $('actorHeading').innerHTML = !actor || actor.id === state.enemy.id
    ? `<span>${actor?.id === state.enemy.id ? 'BRINEBOUND IS MOVING' : 'THE CURRENT MOVES'}</span><span>${actor?.id === state.enemy.id ? 'The shelf answers' : 'Calculating turn order'}</span>`
    : `<span>${actor.name.toUpperCase()}’S TURN</span><span>${actor.role} · ${actor.speed} SPD</span>`;
}

function renderTimeline() {
  const upcoming = [...state.timeline].sort((a, b) => a.at - b.at).slice(0, 7);
  if (state.activeId) upcoming.unshift({ id: state.activeId, current: true });
  $('turnOrder').innerHTML = upcoming.map((entry, index) => {
    const unit = unitById(entry.id); if (!unit) return '';
    const enemy = unit.id === state.enemy.id;
    return `${index ? '<span class="turn-separator" aria-hidden="true">›</span>' : ''}<span class="turn-token ${enemy ? 'is-enemy' : ''} ${entry.current ? 'is-current' : ''}" title="${unit.name}${entry.current ? ' · acting now' : ''}">${unit.mark || '◈'}</span>`;
  }).join('');
}

function renderParty() {
  $('partyPanel').querySelector('.party-count').textContent = `${aliveParty().length} / 3 READY`;
  $('partyCards').innerHTML = state.party.map((unit) => {
    const hpPct = Math.max(0, unit.hp / unit.maxHp * 100); const mpPct = Math.max(0, unit.mp / unit.maxMp * 100);
    return `<div class="party-card ${state.activeId === unit.id ? 'is-active' : ''} ${unit.hp <= 0 ? 'is-dead' : ''}" style="--unit-color:${unit.color}"><span class="party-crest">${unit.mark}</span><span class="party-name"><strong>${unit.name}</strong><span>${unit.role}</span></span><span class="stat-bars"><span class="stat-row"><span>HP</span><span class="stat-track"><span class="stat-fill hp-fill" style="width:${hpPct}%"></span></span><span>${unit.hp}/${unit.maxHp}</span></span><span class="stat-row"><span>MP</span><span class="stat-track"><span class="stat-fill mp-fill" style="width:${mpPct}%"></span></span><span>${unit.mp}/${unit.maxMp}</span></span></span></div>`;
  }).join('');
}

function actionButton(label, action, detail = '', key = '', disabled = false, extra = '') {
  return `<button class="action-button ${extra}" type="button" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}${key ? `<kbd>${key}</kbd>` : ''}${detail ? `<span class="action-subtitle">${detail}</span>` : ''}</button>`;
}

function renderCommand() {
  const actor = unitById(state.activeId);
  if (!canAct()) {
    commandContent.className = 'command-content';
    commandContent.innerHTML = '<span class="command-wait">The next turn is approaching…</span>';
    return;
  }
  if (state.menu === 'root') {
    commandContent.className = 'command-content';
    commandContent.innerHTML = [actionButton('Strike', 'strike', 'Quick physical attack', '1'), actionButton('Technique', 'technique', `${actor.skills.length} arts · ${actor.mp} MP`, '2'), actionButton('Satchel', 'item', `Draught ×${state.items.potion} · Tonic ×${state.items.ether}`, '3'), actionButton('Guard', 'guard', 'Brace · quicker return', '4')].join('');
  } else if (state.menu === 'technique') {
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `${actor.skills.map((skill) => `<button class="action-button skill-choice" type="button" data-action="skill:${skill.id}" ${actor.mp < skill.cost ? 'disabled' : ''}><span>${skill.name}<span class="action-subtitle">${skill.detail}</span></span><span class="skill-cost">${skill.cost} MP</span></button>`).join('')}${actionButton('‹ Back', 'back', '', '', false, 'back-button')}`;
  } else if (state.menu === 'item') {
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `${actionButton('Saltbloom draught', 'potion', `Restore up to 62 HP · ${state.items.potion} left`, '', state.items.potion === 0)}${actionButton('Blueglass tonic', 'ether', `Restore up to 14 MP · ${state.items.ether} left`, '', state.items.ether === 0)}${actionButton('‹ Back', 'back', '', '', false, 'back-button')}`;
  } else if (state.menu === 'target-ally') {
    commandContent.className = 'command-content is-list';
    commandContent.innerHTML = `<span class="action-subtitle">CHOOSE A COMPANION</span>${aliveParty().map((unit) => actionButton(`${unit.name} · ${unit.hp}/${unit.maxHp} HP`, `ally:${unit.id}`)).join('')}${actionButton('‹ Back', 'back', '', '', false, 'back-button')}`;
  }
  commandContent.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action.startsWith('ally:')) chooseAlly(action.slice(5));
    else if (action.startsWith('skill:')) showSkill(actor.skills.find((skill) => skill.id === action.slice(6)));
    else if (action === 'potion' || action === 'ether') useItem(action);
    else if (action === 'back') { state.menu = 'root'; state.pendingAction = null; render(); }
    else chooseRoot(action);
  }));
}

function runDialogue(lines, onComplete) {
  if (dialogueTimer) clearInterval(dialogueTimer);
  dialogue = { lines, index: 0, complete: false, onComplete };
  state.dialogueActive = true;
  $('dialogueBox').classList.remove('is-hidden');
  $('dialogueNext').focus();
  showDialogueLine();
}

function showDialogueLine() {
  const line = dialogue.lines[dialogue.index];
  const actor = state.party.find((unit) => unit.id === line.speaker);
  world.setFocus(line.speaker);
  $('dialogueSpeaker').textContent = actor?.name.toUpperCase() || 'THE SHELF';
  $('dialogueRole').textContent = actor?.role.toUpperCase() || 'A VOICE BELOW';
  $('dialogueMark').textContent = actor?.mark || '✧';
  $('dialoguePortrait').style.setProperty('--portrait-color', actor?.color || '#d8b977');
  $('dialogueText').textContent = '';
  $('dialogueNext').innerHTML = 'CONTINUE <span aria-hidden="true">▸</span>';
  dialogue.complete = false;
  let letters = 0;
  if (dialogueTimer) clearInterval(dialogueTimer);
  dialogueTimer = setInterval(() => {
    letters += 2;
    $('dialogueText').textContent = line.text.slice(0, letters);
    if (letters >= line.text.length) {
      clearInterval(dialogueTimer); dialogueTimer = null; dialogue.complete = true;
      $('dialogueNext').innerHTML = `${dialogue.index === dialogue.lines.length - 1 ? 'BEGIN' : 'CONTINUE'} <span aria-hidden="true">▸</span>`;
    }
  }, 19);
}

function advanceDialogue() {
  if (!dialogue) return;
  if (!dialogue.complete) {
    clearInterval(dialogueTimer); dialogueTimer = null; dialogue.complete = true;
    $('dialogueText').textContent = dialogue.lines[dialogue.index].text;
    $('dialogueNext').innerHTML = `${dialogue.index === dialogue.lines.length - 1 ? 'BEGIN' : 'CONTINUE'} <span aria-hidden="true">▸</span>`;
    return;
  }
  dialogue.index += 1;
  if (dialogue.index < dialogue.lines.length) { showDialogueLine(); return; }
  const done = dialogue.onComplete; dialogue = null; state.dialogueActive = false;
  $('dialogueBox').classList.add('is-hidden');
  world.setFocus(null);
  document.activeElement?.blur?.();
  if (done) done();
}

function finish(won) {
  if (state.over) return;
  state.over = true; state.activeId = null;
  if (won) Tidewheel.award(3);
  render();
  runDialogue(won ? [
    { speaker: 'ren', text: 'It is gone. Tell me that was the thing making the bells ring.' },
    { speaker: 'ilea', text: 'No. It was the thing trying to keep them quiet.' },
    { speaker: 'kael', text: 'Then we keep moving. Whatever is below wants us to hear it.' },
  ] : [
    { speaker: 'ilea', text: 'Back to the waterline. Together.' },
    { speaker: 'kael', text: 'We will return when our path is stronger.' },
  ], () => showEnding(won));
}

function showEnding(won) {
  battleScreen.classList.add('is-hidden'); endingScreen.classList.remove('is-hidden');
  $('endingHeading').innerHTML = won ? 'A quiet <em>return.</em>' : 'The tide <em>takes hold.</em>';
  $('endingCopy').textContent = won
    ? 'The Brinebound breaks apart into a scatter of pale salt. Somewhere beyond the shelf, a bell answers. Your companions turn toward the sound.'
    : 'The Brinebound draws its shadow across the shallows. Your companions retreat together, carrying the last of their strength back to shore.';
  $('rewardCard').innerHTML = won
    ? '<div class="reward-item">FOUND<strong>Saltglass charm</strong></div><div class="reward-item">PATH<strong>+3 SP each</strong></div><div class="reward-item">KEPT<strong>3 together</strong></div>'
    : '<div class="reward-item">RECOVERED<strong>A safe retreat</strong></div><div class="reward-item">KEPT<strong>The way home</strong></div>';
  $('againButton').querySelector('span:first-child').textContent = won ? 'Answer the next bell' : 'Try the passage again';
  $('openGridFromEnding').querySelector('small').textContent = `${Tidewheel.character('kael').sp + Tidewheel.character('ilea').sp + Tidewheel.character('ren').sp} SP READY`;
  updateTitlePointLabel();
  announce(won ? 'Encounter won.' : 'The party retreated.');
}

function updateTitlePointLabel() {
  const points = Object.values(Tidewheel.profile.party).map((member) => member.sp);
  const equal = points.every((value) => value === points[0]);
  $('openGridFromTitle').querySelector('small').textContent = equal ? `${points[0]} SP EACH` : `${points.reduce((sum, value) => sum + value, 0)} SP TOTAL`;
}

function setLog(message) {
  state.log = message; logCount += 1;
  $('battleLog').textContent = message; $('logIndex').textContent = String(logCount).padStart(2, '0'); announce(message);
}
function announce(message) { $('srAnnounce').textContent = message; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function floatNumber(targetId, amount, healing) {
  const number = document.createElement('span');
  number.className = `floating-number ${healing ? 'is-healing' : ''}`;
  number.textContent = healing ? `+${amount}` : `−${amount}`;
  const positions = { kael: [30,47], ilea: [17,42], ren: [40,52], brinebound: [78,43] };
  const [x,y] = positions[targetId] || [50,45];
  number.style.left = `${x}%`; number.style.top = `${y}%`;
  $('floatingNumbers').append(number);
  setTimeout(() => number.remove(), 1100);
}

function openSphereGrid(returnTo) {
  sphereReturn = returnTo;
  selectedGridCharacter = selectedGridCharacter || 'kael';
  selectedGridNode = null;
  sphereOverlay.classList.remove('is-hidden');
  renderSphereGrid();
  $('closeGrid').focus();
}

function closeSphereGrid() {
  sphereOverlay.classList.add('is-hidden');
  const focusTarget = sphereReturn === 'ending' ? $('openGridFromEnding') : $('openGridFromTitle');
  focusTarget?.focus();
}

function renderSphereGrid() {
  const character = partyTemplate.find((unit) => unit.id === selectedGridCharacter);
  const path = Tidewheel.character(character.id);
  const unit = Tidewheel.enhance(character);
  $('gridTabs').innerHTML = partyTemplate.map((member) => `<button type="button" class="grid-tab ${member.id === character.id ? 'is-current' : ''}" data-character="${member.id}" style="--unit-color:${member.color}"><span>${member.mark}</span>${member.name}<small>${Tidewheel.character(member.id).sp} SP</small></button>`).join('');
  updateTitlePointLabel();
  $('gridTabs').querySelectorAll('[data-character]').forEach((tab) => tab.addEventListener('click', () => { selectedGridCharacter = tab.dataset.character; selectedGridNode = null; renderSphereGrid(); }));
  $('gridSvg').innerHTML = Tidewheel.svg(character.id, selectedGridNode);
  $('gridSvg').querySelectorAll('[data-node]').forEach((node) => {
    node.addEventListener('click', () => { selectedGridNode = node.dataset.node; renderSphereGrid(); });
    node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectedGridNode = node.dataset.node; renderSphereGrid(); } });
  });
  $('gridDetailKind').textContent = `${character.name.toUpperCase()} · ${path.sp} SP`;
  $('gridIdentity').textContent = `${character.name} · ${character.role}`;
  $('gridStatList').innerHTML = `<span><i>HP</i><strong>${unit.maxHp}</strong></span><span><i>MP</i><strong>${unit.maxMp}</strong></span><span><i>STR</i><strong>${unit.power}</strong></span><span><i>DEF</i><strong>${unit.defense}</strong></span><span><i>SPD</i><strong>${unit.speed}</strong></span><span><i>ARTS</i><strong>${unit.skills.length}</strong></span>`;
  $('gridVictoryCount').textContent = `${Tidewheel.profile.victories} ${Tidewheel.profile.victories === 1 ? 'VICTORY' : 'VICTORIES'} · ${path.nodes.length} NODES ATTUNED`;
  const detail = selectedGridNode ? Tidewheel.describeNode(character.id, selectedGridNode) : null;
  const action = $('activateNode');
  if (!detail) {
    $('gridDetailTitle').textContent = 'Choose a node';
    $('gridDetailCopy').textContent = 'Your companions begin on different shores of the same constellation. Follow each connected path to shape a distinct role.';
    $('gridDetailNote').textContent = `${unit.skills.length} arts ready · ${path.nodes.length} nodes attuned`;
    action.disabled = true; action.textContent = 'SELECT A CONNECTED NODE';
  } else {
    $('gridDetailTitle').textContent = detail.starterFor ? `${character.name}’s origin` : detail.label;
    const reward = detail.reward;
    const description = reward.skill ? `${reward.skill.name}: ${reward.skill.detail}. Adds this art to ${character.name}’s Technique menu.` : Object.entries(reward).map(([key,value]) => `+${value} ${({maxHp:'maximum HP',maxMp:'maximum MP',power:'strength',magic:'magic',defense:'defense',speed:'speed'})[key] || key}`).join(' · ');
    $('gridDetailKind').textContent = detail.active ? 'ALREADY ATTUNED' : detail.reachable ? `${detail.type.toUpperCase()} NODE · CONNECTED` : detail.owner && detail.owner !== character.id ? 'ANOTHER WAYFARER’S ART' : 'PATH NOT CONNECTED';
    $('gridDetailCopy').textContent = detail.starterFor ? 'This is where their path begins.' : description;
    $('gridDetailNote').textContent = detail.active ? 'The current already runs through this sphere.' : detail.owner && detail.owner !== character.id ? `Only ${detail.owner[0].toUpperCase()}${detail.owner.slice(1)} can attune this art.` : detail.reachable ? 'Spend one Sphere Point to carry this node into battle.' : 'Activate a neighboring node to reach this one.';
    action.disabled = !detail.reachable || !detail.affordable;
    action.textContent = detail.active ? 'ATTUNED' : !detail.reachable ? 'PATH NOT CONNECTED' : !detail.affordable ? 'NEED 1 SP' : 'ATTUNE NODE · 1 SP';
  }
  action.onclick = () => {
    if (selectedGridNode && Tidewheel.activate(character.id, selectedGridNode)) { updateTitlePointLabel(); renderSphereGrid(); }
  };
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  $('soundToggle').setAttribute('aria-pressed', String(soundEnabled));
  $('soundLabel').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  if (soundEnabled && (window.AudioContext || window.webkitAudioContext)) playNote(392, .14);
}
function playNote(frequency,duration) {
  if (!soundEnabled) return; const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  audioContext ||= new Context(); const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration);
}

$('beginJourney').addEventListener('click', newGame);
$('againButton').addEventListener('click', newGame);
$('dialogueNext').addEventListener('click', advanceDialogue);
$('soundToggle').addEventListener('click', toggleSound);
$('openGridFromTitle').addEventListener('click', () => openSphereGrid('title'));
$('openGridFromEnding').addEventListener('click', () => openSphereGrid('ending'));
$('closeGrid').addEventListener('click', closeSphereGrid);
updateTitlePointLabel();
document.addEventListener('click', (event) => {
  const action=event.target.closest('[data-action]');
  if(action&&soundEnabled)playNote(action.disabled?180:330,.07);
});
document.addEventListener('keydown', (event) => {
  if(!sphereOverlay.classList.contains('is-hidden')){if(event.key==='Escape')closeSphereGrid();return;}
  if(dialogue){if(event.key==='Enter'||event.key===' '){if(event.target.closest('button'))return;event.preventDefault();advanceDialogue();}return;}
  if(event.key==='Escape'&&canAct()&&state.menu!=='root'){state.menu='root';state.pendingAction=null;render();return;}
  if(/^[1-4]$/.test(event.key)&&canAct()&&state.menu==='root')chooseRoot(['','strike','technique','item','guard'][Number(event.key)]);
  if(event.key==='Enter'&&!event.target.closest('button, a, input, textarea, select')&&!titleScreen.classList.contains('is-hidden')){newGame();return;}
  if(event.key==='Enter'&&!event.target.closest('button, a, input, textarea, select')&&canAct()&&state.menu==='root'){chooseRoot('strike');return;}
  if(event.key==='Enter'&&!event.target.closest('button, a, input, textarea, select')&&canAct()&&state.menu==='target-ally'){const first=aliveParty()[0];if(first)chooseAlly(first.id);return;}
});
