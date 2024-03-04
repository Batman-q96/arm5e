import { log, putInFoldableLinkWithAnimation } from "../tools.js";
import { stressDie } from "../dice.js";

// export function doubleAbility(actor) {
//   actor.rollData.ability.score *= 2;
// }

export async function exertSelf(actor, mode, callback) {
  log(false, "Exert self in combat");

  actor.rollData.combat.exertion = true;

  await stressDie(actor, actor.rollData.type, callback, mode, -1);

  await actor.loseFatigueLevel(1);
}

export function computeCombatStats(actor) {
  return {
    init:
      actor.system.combat.init -
      actor.system.combat.overload +
      actor.system.characteristics.qik.value,
    attack:
      actor.system.combat.atk +
      actor.system.combat.ability +
      actor.system.characteristics.dex.value,
    defense:
      actor.system.combat.dfn +
      actor.system.combat.ability +
      actor.system.characteristics.qik.value,
    damage: actor.system.combat.dam + actor.system.characteristics.str.value,
    soak:
      actor.system.combat.prot +
      actor.system.characteristics.sta.value +
      actor.system.bonuses.traits.soak
  };
}

export class QuickCombat extends FormApplication {
  constructor(data, options) {
    super(data, options);

    this.object.actor.apps[this.appId] = this;
    Hooks.on("closeApplication", (app, html) => this.onClose(app));
  }
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["arm5e-dialog", "dialog"],
      title: game.i18n.localize("arm5e.sheet.combat"),
      template: "systems/arm5e/templates/generic/quick-combat.html",
      width: "auto",
      height: "auto",
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  onClose(app) {
    if (this.object.actor.apps[app.appId] != undefined) {
      delete this.object.actor.apps[app.appId];
    }
  }

  async getData(options = {}) {
    let sys = {
      combat: this.object.actor.system.combat,
      characteristics: this.object.actor.system.characteristics
    };
    const context = {
      name: this.object.name,
      system: sys,
      combat: computeCombatStats(this.object.actor)
    };
    log(false, `QuickCombat: ${JSON.stringify(context)}`);
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rollable").click(async (event) => await this.object.actor.sheet._onRoll(event));
    html
      .find(".soak-damage")
      .click(async (event) => await this.object.actor.sheet._onSoakDamage(event));
    html
      .find(".damage")
      .click(async (event) => await this.object.actor.sheet._onCalculateDamage(event));
  }
}
export async function quickCombat(tokenName, actor) {
  if (!actor._isCharacter()) return;

  const combat = new QuickCombat(
    {
      name: tokenName,
      actor: actor
    },
    {}
  );
  const res = await combat.render(true);
}

export class QuickVitals extends FormApplication {
  constructor(data, options) {
    super(data, options);

    this.object.actor.apps[this.appId] = this;
    Hooks.on("closeApplication", (app, html) => this.onClose(app));
  }
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["arm5e-dialog", "dialog"],
      title: game.i18n.localize("arm5e.sheet.vitals"),
      template: "systems/arm5e/templates/generic/quick-vitals.html",
      width: 200,
      height: "auto",
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  onClose(app) {
    if (this.object.actor.apps[app.appId] != undefined) {
      delete this.object.actor.apps[app.appId];
    }
  }

  async getData(options = {}) {
    const context = {
      name: this.object.name,
      actor: this.object.actor,
      woundCfg: CONFIG.ARM5E.character.wounds,
      conscious: this.object.actor.system.fatigueCurrent < this.object.actor.system.fatigueMaxLevel
    };
    log(false, `Vitals: ${context}, Fatigue: ${context.actor.system.fatigueCurrent}`);
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rest").click(async () => {
      await this.object.actor.rest();
      this.render();
    });
    html.find(".addFatigue").click(async () => {
      await this.object.actor._changeFatigueLevel(1, false);
      this.render();
    });
    html.find(".removeFatigue").click(async () => {
      await this.object.actor._changeFatigueLevel(-1, false);
      this.render();
    });
    html.find(".addWound").click(async (event) => {
      event.preventDefault();
      const dataset = event.currentTarget.dataset;
      await this.object.actor.changeWound(1, dataset.type);
      this.render();
    });
    html.find(".recovery").click(async (event) => {
      event.preventDefault();
      const dataset = event.currentTarget.dataset;
      await this.object.actor.sheet.render(true);
      this.render();
    });
  }
}

export async function quickVitals(tokenName, actor) {
  if (!actor._isCharacter()) return;

  const vitals = new QuickVitals(
    {
      name: tokenName,
      actor: actor
    },
    {}
  ); // data, options
  const res = await vitals.render(true);
}

export async function combatDamage(selector, actor) {
  const title = '<h2 class="ars-chat-title">' + game.i18n.localize("arm5e.sheet.damage") + " </h2>";
  let damage = parseInt(selector.find('input[name$="modifier"]').val());
  const messageModifier = `${game.i18n.localize("arm5e.sheet.modifier")} (${damage})`;
  let details = "";
  const strenght = parseInt(selector.find('label[name$="strenght"]').attr("value") || 0);
  const weapon = parseInt(selector.find('label[name$="weapon"]').attr("value") || 0);
  const advantage = parseInt(selector.find('input[name$="advantage"]').val());
  const messageStrenght = `${game.i18n.localize("arm5e.sheet.strength")} (${strenght})`;
  const messageWeapon = `${game.i18n.localize("arm5e.sheet.damage")} (${weapon})`;
  const messageAdvantage = `${game.i18n.localize("arm5e.sheet.advantage")} (${advantage})`;
  damage += strenght + weapon + advantage;
  details = ` ${messageStrenght}<br/> ${messageWeapon}<br/> ${messageAdvantage}<br/> ${messageModifier}<br/>`;

  const messageDamage = `<h4 class="dice-total">${damage}</h4>`;
  ChatMessage.create({
    content: messageDamage,
    flavor: title + putInFoldableLinkWithAnimation("arm5e.sheet.label.details", details),
    speaker: ChatMessage.getSpeaker({
      actor
    })
  });
}

export async function rolledDamage(soakData, actor) {
  const dataset = {
    roll: "option",
    name: game.i18n.localize("arm5e.sheet.damageRoll"),
    physicalcondition: false,
    modifier: -soakData.modifier,
    option1: soakData.damage,
    txtoption1: game.i18n.localize("arm5e.sheet.damage"),
    option4: soakData.prot,
    txtoption4: game.i18n.localize("arm5e.sheet.protection"),
    operator4: "-",
    option5: soakData.stamina,
    txtoption5: game.i18n.localize("arm5e.sheet.stamina"),
    operator5: "-"
  };

  if (soakData.natRes) {
    dataset.option2 = soakData.natRes;
    dataset.txtoption2 = game.i18n.localize("arm5e.sheet.natRes");
    dataset.operator2 = "-";
  }
  if (soakData.formRes) {
    dataset.option3 = soakData.formRes;
    dataset.txtoption3 = game.i18n.localize("arm5e.sheet.formRes");
    dataset.operator3 = "-";
  }

  if (soakData.bonus) {
    dataset.option6 = soakData.bonus;
    dataset.txtoption6 = game.i18n.localize("arm5e.sheet.soakBonus");
    dataset.operator6 = "-";
  }

  actor.rollData.init(dataset, actor);
  let roll = await stressDie(actor, "option", 16, null, 1);
  soakData.roll = roll.total - roll.offset;
  soakData.damageToApply += soakData.roll;
}

export function buildSoakDataset(selector) {
  const dataset = {};

  dataset.modifier = parseInt(selector.find('input[name$="modifier"]').val());
  dataset.damage = parseInt(selector.find('input[name$="damage"]').val());
  dataset.natRes = parseInt(selector.find('select[name$="natRes"]').val() || 0);
  dataset.formRes = parseInt(selector.find('select[name$="formRes"]').val() || 0);
  dataset.prot = parseInt(selector.find('label[name$="prot"]').attr("value") || 0);
  dataset.bonus = parseInt(selector.find('label[name$="soak"]').attr("value") || 0);
  dataset.stamina = parseInt(selector.find('label[name$="stamina"]').attr("value") || 0);
  dataset.damageToApply =
    dataset.damage -
    dataset.modifier -
    dataset.prot -
    dataset.natRes -
    dataset.formRes -
    dataset.stamina -
    dataset.bonus;
  return dataset;
}
