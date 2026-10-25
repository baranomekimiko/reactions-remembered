const ID = "reactions-remembered";
const STATUS = "occupied";
const CUSTOM_DND5E = "custom-dnd5e";
const ICON = `modules/${ID}/assets/occupied.svg`;
const RULE_UUID = `Compendium.${ID}.rules.JournalEntry.OccupiedRule0001.JournalEntryPage.OccupiedPage0001`;
const MANAGED = { img: ICON, reference: RULE_UUID };
const TRIGGERS = ["attack", "spell", "reaction", "movement"];
const IGNORED_ACTIVATIONS = new Set(["legendary", "lair"]);
const IGNORED_ACTIONS = new Set(["displace", "blink"]);
const MOVE_METHODS = new Set(["dragging", "keyboard"]);
const armed = new Map();

//#region Setup
Hooks.once("init", () => {
  game.settings.register(ID, "triggers", {
    name: "OCCUPIED.Settings.triggers.Name",
    hint: "OCCUPIED.Settings.triggers.Hint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.SetField(new foundry.data.fields.StringField({
      choices: () => Object.fromEntries(TRIGGERS.map(key => [key, game.i18n.localize(`OCCUPIED.Settings.triggers.${key}`)]))
    })),
    default: TRIGGERS
  });

  game.settings.register(ID, "movementNotice", {
    name: "OCCUPIED.Settings.movementNotice.Name",
    hint: "OCCUPIED.Settings.movementNotice.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  ensureCondition();

  game.keybindings.register(ID, "toggle", {
    name: "OCCUPIED.Keybind",
    editable: [{ key: "KeyR", modifiers: ["Control"] }],
    restricted: false,
    onDown: toggleSelected
  });
});

Hooks.once("setup", ensureCondition);
Hooks.once("ready", ensureCondition);
//#endregion

//#region Condition registry
function hiddenInCustom() {
  const key = `${CUSTOM_DND5E}.conditions`;
  return game.settings.settings.has(key) && game.settings.get(CUSTOM_DND5E, "conditions")?.[STATUS]?.visible === false;
}

function conditionType() {
  return { name: "OCCUPIED.Status", ...MANAGED };
}

function statusEffect() {
  return { _id: dnd5e.utils.staticID(`dnd5e${STATUS}`), id: STATUS, ...conditionType() };
}

function addType(types) {
  Object.assign(types[STATUS] ??= conditionType(), MANAGED);
}

function addStatus(list) {
  Object.assign(list.find(e => e.id === STATUS) ?? list[list.push(statusEffect()) - 1], MANAGED);
}

function ensureCondition() {
  if (hiddenInCustom()) return;
  addType(CONFIG.DND5E.conditionTypes);
  addStatus(CONFIG.statusEffects);
}

Hooks.on("customDnd5e.setConditionTypesConfig", types => {
  if (!hiddenInCustom()) addType(types);
});

Hooks.on("customDnd5e.setStatusEffectsConfig", list => {
  if (!hiddenInCustom()) addStatus(list);
});
//#endregion

//#region Effect timing
function ownCombatant(actor) {
  return game.combat?.started ? game.combat.combatants.find(c => c.actor === actor) : null;
}

Hooks.on("preCreateActiveEffect", effect => {
  if (!effect.statuses.has(STATUS)) return;
  effect.updateSource({ "duration.value": 1, "duration.units": "turns", "duration.expiry": "turnStart" });
  const combatant = ownCombatant(effect.parent);
  if (combatant) effect.updateSource({ "start.combatant": combatant.id });
});

Hooks.on("preUpdateActiveEffect", (effect, changes) => {
  if (!game.user.isActiveGM || !effect.statuses.has(STATUS)) return;
  if (!foundry.utils.expandObject(changes).duration?.expired) return;
  effect.delete();
  return false;
});
//#endregion

//#region Toggle
function toggleSelected() {
  const tokens = canvas.tokens?.controlled.length ? canvas.tokens.controlled : [canvas.tokens?.hover];
  const actors = new Set(tokens.map(t => t?.actor).filter(a => a?.isOwner));
  actors.forEach(actor => actor.toggleStatusEffect(STATUS));
  return actors.size > 0;
}
//#endregion

//#region Combat gating
function syncHooks() {
  const inCombat = !!game.combat?.started;
  if (inCombat && !armed.size) arm();
  else if (!inCombat && armed.size) disarm();
}

function arm() {
  armed.set("dnd5e.rollAttack", Hooks.on("dnd5e.rollAttack", onRoll));
  armed.set("dnd5e.postUseActivity", Hooks.on("dnd5e.postUseActivity", onUse));
  armed.set("renderActivityUsageDialog", Hooks.on("renderActivityUsageDialog", dialog => addNote(dialog, dialog.activity)));
  armed.set("renderAttackRollConfigurationDialog", Hooks.on("renderAttackRollConfigurationDialog", dialog => addNote(dialog, dialog.config.subject)));
  armed.set("preMoveToken", Hooks.on("preMoveToken", onMove));
}

function disarm() {
  for (const [name, id] of armed) Hooks.off(name, id);
  armed.clear();
}

for (const name of ["ready", "canvasReady", "updateCombat", "deleteCombat"]) Hooks.on(name, syncHooks);
//#endregion

//#region Triggers
function findCombatant(match) {
  return game.combat?.combatants.find(c => !c.isDefeated && match(c));
}

function isTurn(combatant) {
  return combatant.id === game.combat.combatant?.id;
}

function triggerOf(activity) {
  const type = activity.activation?.type;
  if (type === "reaction") return "reaction";
  if (IGNORED_ACTIVATIONS.has(type)) return null;
  if (activity.type === "attack") return "attack";
  return activity.item.type === "spell" ? "spell" : null;
}

function triggerOn(trigger) {
  return game.settings.get(ID, "triggers").has(trigger);
}

async function markOccupied(combatant, trigger) {
  const actor = combatant.actor;
  if (!actor || actor.statuses.has(STATUS)) return;
  if (Hooks.call("reactionsRemembered.preApply", actor, combatant, trigger) === false) return;
  await actor.toggleStatusEffect(STATUS, { active: true });
  Hooks.callAll("reactionsRemembered.applied", actor, combatant, trigger);
  if (trigger === "movement" && game.settings.get(ID, "movementNotice")) ui.notifications.info(game.i18n.localize("OCCUPIED.Moved"));
}

function apply(actor, trigger) {
  if (!actor || !triggerOn(trigger)) return;
  const combatant = findCombatant(c => c.actor === actor);
  if (combatant && (trigger === "reaction" || !isTurn(combatant))) markOccupied(combatant, trigger);
}

function onUse(activity) {
  const trigger = triggerOf(activity);
  if (trigger === "reaction" || trigger === "spell") apply(activity.actor, trigger);
}

function onRoll(rolls, data) {
  if (triggerOf(data.subject) === "attack") apply(data.subject.actor, "attack");
}

function onMove(token, movement) {
  if (game.user.isGM || !triggerOn("movement") || !MOVE_METHODS.has(movement.method)) return;
  const { distance, waypoints } = movement.passed;
  if (!distance || waypoints.every(w => IGNORED_ACTIONS.has(w.action))) return;
  const combatant = findCombatant(c => c.tokenId === token.id);
  if (combatant && !isTurn(combatant)) markOccupied(combatant, "movement");
}
//#endregion

//#region Warning
function warningFor(activity) {
  const trigger = triggerOf(activity);
  const actor = activity.actor;
  if (!trigger || !actor || !triggerOn(trigger)) return null;
  const occupied = actor.statuses.has(STATUS);
  if (trigger === "reaction") return occupied ? "OCCUPIED.Warning" : null;
  const combatant = findCombatant(c => c.actor === actor);
  if (!combatant || isTurn(combatant)) return null;
  return occupied ? "OCCUPIED.Warning" : "OCCUPIED.WarningOffTurn";
}

function addNote(dialog, activity) {
  const key = activity && warningFor(activity);
  const content = dialog.element.querySelector(".window-content");
  if (!key || !content || content.querySelector(".occupied-note")) return;
  const section = document.createElement("section");
  section.className = "occupied-note";
  section.innerHTML = `<p class="note warn">${game.i18n.localize(key)}</p>`;
  content.prepend(section);
}
//#endregion
