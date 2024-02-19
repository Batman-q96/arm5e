// Prototype WIP

import { ARM5E } from "../config.js";
import ArM5eActiveEffect from "../helpers/active-effects.js";
import { computeRawCastingTotal } from "../helpers/magic.js";
import { ArM5eItemMagicSheet } from "../item/item-magic-sheet.js";
import { EnchantmentExtension } from "../schemas/enchantmentSchema.js";
import { error, getDataset, log } from "../tools.js";

class Activity {
  constructor(actorUuid, type) {
    this.actorUuid = actorUuid;
    this.type = type;
  }

  validation(input) {
    log("false", "NO EXISTING VALIDATION ");
    return { valid: true, duration: 1, message: "No validation", waste: 0 };
  }

  async application() {}

  get template() {
    return "";
  }
}

class AgingActivity extends Activity {}

class ProgressActivity extends Activity {}

class BookActivity extends ProgressActivity {
  constructor(actorUuid, book, type) {
    super(actorUuid, type);
    this.book = book;
  }
}

export class LabActivity extends Activity {
  constructor(labUuid, actorUuid, type) {
    super(actorUuid, type);
    this.labUuid = labUuid;
    this.labSpecTotal = 0;
    this.ownerActivityMod = 0;
  }

  static ActivityFactory(lab, type) {
    switch (type) {
      case "none":
        return new NoLabActivity(lab.uuid);
      case "inventSpell":
      case "learnSpell":
        return new SpellActivity(lab.uuid, lab.system.owner.document.uuid, type);
      case "minorEnchantment":
        return new MinorEnchantment(lab.uuid, lab.system.owner.document.uuid);
      case "chargedItem":
        return new ChargedItem(lab.uuid, lab.system.owner.document.uuid);
      case "visExtraction":
        return new VisExtractionActivity(lab.uuid, lab.system.owner.document.uuid);
      case "longevityRitual":
        return new LongevityRitualActivity(lab.uuid, lab.system.owner.document.uuid);
      default:
        log(false, "Unknown activity");
        return new SpellActivity(lab.uuid, lab.system.owner.document.uuid, "inventSpell");
    }
  }

  get hasVisCost() {
    return false;
  }

  getTechnicalPart(data) {
    return "";
  }

  getDiaryName(planning) {
    return game.i18n.localize(CONFIG.ARM5E.activities.lab[this.type].label);
  }

  getDiaryDescription(planning) {
    return `${this.getDiaryName(planning)} : ${planning.label}<br/>${game.i18n.localize(
      "arm5e.sheet.labTotal"
    )}: <b>${planning.labTotal.score}</b> <br/> ${planning.labTotal.label}`;
  }

  activateListeners(html) {}

  async getDefaultData() {
    return await Item.create(
      {
        name: this.title,
        type: "spell"
        // system:
      },
      { temporary: true, render: false }
    );
  }

  get title() {
    return game.i18n.localize("arm5e.activity.activity");
  }

  async activityAchievement(input) {
    return null;
  }

  prepareData(input) {
    return input;
  }

  get activitySheet() {
    return "systems/arm5e/templates/lab-activities/noparams.html";
  }

  labActivitySpec(lab) {
    return { mod: 0, label: "" };
  }

  validateVisCost(data) {
    const result = { valid: true, message: "" };
    if (!this.hasVisCost) return result;

    let available = Object.values(data.magus).reduce(
      (accumulator, currentValue) => accumulator + currentValue.amount,
      0
    );
    available = Object.values(data.lab).reduce(
      (accumulator, currentValue) => accumulator + currentValue.amount,
      available
    );
    if (available < data.amount) {
      result.message = game.i18n.localize("arm5e.activity.msg.noEnoughVis");
      result.valid = false;
    }
    let sum = Object.values(data.magus).reduce(
      (accumulator, currentValue) => accumulator + (Number(currentValue.used) ?? 0),
      0
    );
    sum = Object.values(data.lab).reduce(
      (accumulator, currentValue) => accumulator + (Number(currentValue.used) ?? 0),
      sum
    );
    if (sum != data.amount) {
      result.message = game.i18n.localize("arm5e.activity.msg.wrongVisAmount");
      result.valid = false;
    }
    return result;
  }

  computeLabTotal(lab, actor, data, distractions) {
    return this._computeLabTotal(lab, actor, data, distractions);
  }

  _computeLabTotal(lab, actor, data, distractions) {
    let labTot = computeRawCastingTotal(data, actor);

    let total = labTot.total;
    labTot.label += `+ ${game.i18n.localize("arm5e.sheet.int")} (${
      actor.system.characteristics.int.value
    }) &#10`;
    total += actor.system.characteristics.int.value;
    let MTscore = actor.getAbilityStats("magicTheory").score;
    labTot.label += `+ ${game.i18n.localize("arm5e.skill.arcane.magicTheory")} (${MTscore}`;
    total += MTscore;
    if (this.modifiers.magicThSpecApply) {
      labTot.label += ` + 1`;
      total++;
    }
    labTot.label += `)&#10`;

    for (let [key, mod] of Object.entries(this.modifiers)) {
      if (key == "magicThSpecApply") continue;

      if (["philosophy", "aspects"].includes(key)) continue;
      total += mod;
      if (mod != 0) {
        labTot.label += `+ ${game.i18n.localize("arm5e.lab.bonus." + key)} (${mod}) &#10`;
      }
    }

    //special case for aspect and Verditius Magic

    if (this.modifiers.aspects) {
      labTot.label += `+ ${game.i18n.localize("arm5e.lab.bonus.aspects")} (${
        this.modifiers.aspects
      }) &#10`;
      total += this.modifiers.aspects;
      if (this.modifiers.philosophy) {
        labTot.label += `   ( +${this.modifiers.philosophy} ${game.i18n.localize(
          "arm5e.lab.bonus.aspectsVerditius"
        )}, `;
      } else {
        labTot.label += "   (";
      }
      labTot.label += `${game.i18n.localize("arm5e.lab.bonus.aspectsMax")})&#10`;
    }

    // lab specialties
    let labSpec = lab.system.specialty[data.system.technique.value].bonus;
    this.labSpecTotal = labSpec;
    if (labSpec != 0) {
      total += labSpec;
      labTot.label += `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${
        CONFIG.ARM5E.magic.arts[data.system.technique.value].short
      } (${labSpec}) &#10`;
    }
    labSpec = lab.system.specialty[data.system.form.value].bonus;
    this.labSpecTotal += labSpec;
    if (labSpec != 0) {
      total += labSpec;
      labTot.label += `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${
        CONFIG.ARM5E.magic.arts[data.system.form.value].short
      } (${labSpec}) &#10`;
    }

    // activities specialties
    labSpec = this.labActivitySpec(lab);

    if (labSpec.mod != 0) {
      this.labSpecTotal += labSpec.mod;
      total += labSpec.mod;
      labTot.label += labSpec.label;
    }

    // owner modifiers
    let effects = ArM5eActiveEffect.findAllActiveEffectsWithSubtypeFiltered(
      actor.effects,
      this.type
    );

    this.ownerActivityMod = 0;
    for (let e of effects) {
      for (let ch of e.changes) {
        this.ownerActivityMod += Number(ch.value);
      }
    }
    if (this.ownerActivityMod > 0) {
      total += this.ownerActivityMod;
      labTot.label += `+ ${game.i18n.localize("arm5e.lab.bonus.activity")} (${
        this.ownerActivityMod
      })&#10`;
    }

    let deficiencyDivider = 1;
    if (labTot.deficientTech && labTot.deficientForm) {
      deficiencyDivider = 4;
    } else if (labTot.deficientTech || labTot.deficientForm) {
      deficiencyDivider = 2;
    }
    if (deficiencyDivider > 1) {
      labTot.label += game.i18n.format("arm5e.lab.planning.msg.artDeficiency", {
        divisor: deficiencyDivider
      });
    }
    let coeff = CONFIG.ARM5E.activities.distractions[distractions ?? "none"].coeff;
    if (coeff != 1) {
      labTot.label += `* ${coeff.toFixed(2)} (${game.i18n.localize(
        "arm5e.lab.distraction.label"
      )})&#10`;
    }

    return { score: Math.round((total / deficiencyDivider) * coeff), label: labTot.label };
  }
}

// blank acivity for labs without owner
export class NoLabActivity extends LabActivity {
  constructor(labUuid) {
    super(labUuid, null, "none");
    this.labSpecTotal = 0;
    this.ownerActivityMod = 0;
  }
}

export class SpellActivity extends LabActivity {
  constructor(labUuid, actorUuid, type) {
    super(labUuid, actorUuid, type);
  }

  get title() {
    return game.i18n.localize("arm5e.activity.newSpellName");
  }

  get hasWaste() {
    return true;
  }

  getDiaryName(planning) {
    return planning.data.name;
  }

  async getDefaultData() {
    const effect = await Item.create(
      {
        name: this.title,
        type: "spell"
        // system:
      },
      { temporary: true, render: false }
    );
    return effect.toObject();
  }

  get activitySheet() {
    return "systems/arm5e/templates/lab-activities/spell.html";
  }

  validation(input) {
    if ("inventSpell" == this.type) {
      return this._validateInvention(input);
    } else {
      return this._validateSpellLearning(input);
    }
  }

  _validateInvention(planning) {
    let lvl = planning.data.system.level;
    let delta = planning.labTotal.score - lvl;
    if (delta < 1) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.notSkilledInvent")
      };
    } else if (delta >= lvl) {
      return { valid: true, waste: delta - lvl, duration: 1, message: "" };
    } else {
      let dur = Math.ceil(lvl / delta);
      return {
        valid: true,
        waste: (delta * dur) % lvl,
        duration: dur,
        message: ""
      };
    }
  }
  _validateSpellLearning(planning) {
    let delta = planning.labTotal.score - planning.data.system.level;
    if (delta < 0) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.notSkilledLearn")
      };
    }

    return { valid: true, waste: delta, duration: 1, message: "" };
  }

  labActivitySpec(lab) {
    if ("inventSpell" == this.type) {
      return {
        mod: lab.system.specialty.spells.bonus,
        label: `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${game.i18n.localize(
          "arm5e.lab.specialty.spells"
        )} (${lab.system.specialty.spells.bonus}) &#10`
      };
    } else {
      return {
        mod: lab.system.specialty.texts.bonus,
        label: `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${game.i18n.localize(
          "arm5e.lab.specialty.texts"
        )} (${lab.system.specialty.texts.bonus}) &#10`
      };
    }
  }
}

export class LongevityRitualActivity extends LabActivity {
  constructor(lab, actor, target) {
    super(lab, actor, "longevityRitual");
    this.target = target ?? actor;
  }

  get hasVisCost() {
    return true;
  }

  get hasWaste() {
    return false;
  }

  get title() {
    return game.i18n.localize("arm5e.activity.longevityRitual");
  }

  labActivitySpec(lab) {
    return {
      mod: lab.system.specialty.longevityRituals.bonus,
      label: `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${game.i18n.localize(
        "arm5e.lab.specialty.longevityRituals"
      )} (${lab.system.specialty.longevityRituals.bonus}) &#10`
    };
  }
  validation(input) {
    let isValid = true;
    let msg = game.i18n.format("arm5e.lab.planning.msg.longevityBonus", {
      bonus: Math.ceil(input.labTotal.score / 5)
    });

    return {
      valid: isValid,
      waste: 0,
      duration: 1,
      message: msg
    };
  }

  getVisCost(input) {
    return {
      amount: Math.ceil(input.labTotal.score / 10),
      technique: "cr",
      form: "co"
    };
  }
  async application() {}
}

export class VisExtractionActivity extends LabActivity {
  constructor(lab, actor) {
    super(lab, actor, "visExtraction");
  }

  labActivitySpec(lab) {
    return {
      mod: lab.system.specialty.visExtraction.bonus,
      label: `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${game.i18n.localize(
        "arm5e.lab.specialty.visExtraction"
      )} (${lab.system.specialty.visExtraction.bonus}) &#10`
    };
  }

  get title() {
    return game.i18n.localize("arm5e.activity.visExtraction");
  }

  getDiaryName(planning) {
    return game.i18n.format("arm5e.lab.planning.msg.visExtracted", {
      num: Math.ceil(planning.labTotal.score / 10)
    });
  }

  getDiaryDescription(planning) {
    return `${this.getDiaryName(planning)} : ${game.i18n.localize("arm5e.sheet.labTotal")}: <b>${
      planning.labTotal.score
    }</b> <br/> ${planning.labTotal.label}`;
  }

  async activityAchievement(input) {
    let actor;
    if (this.actorUuid) {
      actor = await fromUuid(this.actorUuid);
    } else {
      let lab = await fromUuid(this.labUuid);
      actor = await fromUuid(lab.system.owner.document.uuid);
    }
    return {
      name: "Vim vis",
      type: "vis",
      system: {
        art: "vi",
        quantity: Math.ceil(input.labTotal.score / 10),
        description: game.i18n.format("arm5e.lab.planning.msg.visExtracted2", {
          covenant: actor.system.covenant.value
        })
      }
    };
  }

  validation(input) {
    let isValid = true;
    let msg = game.i18n.format("arm5e.lab.planning.msg.visExtracted", {
      num: Math.ceil(input.labTotal.score / 10)
    });
    if (input.modifiers.aura == 0) {
      msg = game.i18n.localize("arm5e.lab.planning.msg.visExtracted3");
      isValid = false;
    }
    return {
      valid: isValid,
      waste: 0,
      duration: 1,
      message: msg
    };
  }
  async application() {}
}

export class MinorEnchantment extends LabActivity {
  constructor(lab, actor) {
    super(lab, actor, "minorEnchantment");
  }

  get hasVisCost() {
    return true;
  }

  get title() {
    return game.i18n.localize("arm5e.activity.minorEnchantment");
  }
  getDiaryName(planning) {
    return planning.data.receptacle.name;
  }

  getDiaryDescription(planning) {
    return `${planning.data.receptacle.name}<br/>${planning.data.enchantment.name} : ${
      planning.label
    }<br/>${game.i18n.localize("arm5e.sheet.labTotal")}: <b>${planning.labTotal.score}</b> <br/> ${
      planning.labTotal.label
    }`;
  }

  computeLabTotal(lab, actor, data, distractions) {
    // retrieve shape and material bonus if any
    let MTscore = actor.getAbilityStats("magicTheory").score;
    let philo = { score: 0 };
    if (actor.hasSkill("verditiusMagic")) {
      philo = actor.getAbilityStats("philosophy");
      if (philo.score > 0) {
        this.modifiers["philosophy"] = philo.score;
      }
    }
    if (this.modifiers["magicThSpecApply"]) {
      MTscore++;
    }
    const aspect = data.receptacle.system.enchantments.aspects[0];
    if (aspect?.apply) {
      this.modifiers["aspects"] = Math.min(MTscore, aspect.bonus + philo.score);
    } else {
      delete this.modifiers.aspects;
    }

    return this._computeLabTotal(lab, actor, data.enchantment, distractions);
  }
  async getDefaultData() {
    const result = {};
    let enchant = await Item.create(
      {
        name: "New enchantment",
        type: "enchantment"
      },
      { temporary: true, render: false }
    );

    const receptacleID = foundry.utils.randomID();
    enchant = enchant.toObject();
    enchant.receptacleId = receptacleID;

    let item = await Item.create(
      {
        name: this.title,
        type: "item",
        system: {
          quantity: 1,
          weight: 0,
          state: "appraised",
          enchantments: new EnchantmentExtension()
        }
      },
      { temporary: true, render: false }
    );
    item = item.toObject();

    result.ASPECTS = await ArM5eItemMagicSheet.GetFilteredAspects();

    const first = Object.keys(result.ASPECTS)[0];
    const firstEffect = Object.keys(result.ASPECTS[first].effects)[0];
    item.system.enchantments.capacities = [
      { id: receptacleID, materialBase: "base1", sizeMultiplier: "tiny", desc: "" }
    ];
    item.system.enchantments.aspects = [
      { aspect: first, effect: firstEffect, bonus: firstEffect.bonus, attuned: false, apply: false }
    ];
    result.receptacle = item;
    result.enchantment = enchant;
    result.itemType = "item";
    return result;
  }
  labActivitySpec(lab) {
    return {
      mod: lab.system.specialty.items.bonus,
      label: `+ ${game.i18n.localize("arm5e.sheet.speciality")} ${game.i18n.localize(
        "arm5e.lab.specialty.items"
      )} (${lab.system.specialty.items.bonus}) &#10`
    };
  }

  get activitySheet() {
    return "systems/arm5e/templates/lab-activities/minor-enchantment.html";
  }

  /**
   * Enrich context with specific data for the lab activity
   * @param {any} planning
   * @returns {any}
   */
  prepareData(planning) {
    const receptacleEnchants = planning.data.receptacle.system.enchantments;
    if (receptacleEnchants.aspects.length == 0) {
      error(false, `DEBUG prepareData: WARNING ASPECTS length = 0`);
      const first = Object.keys(planning.data.ASPECTS)[0];
      const firstEffect = Object.keys(planning.data.ASPECTS[first].effects)[0];
      receptacleEnchants.aspects = [
        { aspect: first, effect: firstEffect, bonus: 0, attuned: false, apply: false }
      ];
    }

    receptacleEnchants.aspects[0].effects =
      planning.data.ASPECTS[receptacleEnchants.aspects[0].aspect].effects;
    receptacleEnchants.aspects[0].bonus =
      planning.data.ASPECTS[receptacleEnchants.aspects[0].aspect].effects[
        receptacleEnchants.aspects[0].effect
      ]?.bonus ?? 0;
    receptacleEnchants.capacities[0].used = Math.ceil(planning.data.enchantment.system.level / 10);
    receptacleEnchants.capacities[0].total =
      ARM5E.lab.enchantment.materialBase[receptacleEnchants.capacities[0].materialBase].base *
      ARM5E.lab.enchantment.sizeMultiplier[receptacleEnchants.capacities[0].sizeMultiplier].mult;
    planning.enchantPrefix = planning.namePrefix + "enchantment.";

    return planning;
  }

  validation(input) {
    let lvl = input.data.enchantment.system.level;
    let delta = input.labTotal.score - lvl;
    if (delta < lvl) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.notSkilledEnchant")
      };
    } else if (input.data.receptacle.system.enchantments.capacities[0].total * 10 < lvl) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.smallCapacity")
      };
    } else {
      return {
        valid: true,
        waste: delta - lvl,
        duration: 1,
        message: game.i18n.format("arm5e.lab.planning.msg.visNeeded", {
          num: Math.ceil(lvl / 10)
        })
      };
    }
  }

  getVisCost(input) {
    return {
      amount: Math.ceil(input.data.enchantment.system.level / 10),
      technique: input.data.enchantment.system.technique.value,
      form: input.data.enchantment.system.form.value
    };
  }

  // TODO rework
  async activityAchievement(input) {
    const actor = await fromUuid(this.actorUuid);
    const item = input.data.receptacle;
    const achievement = {
      name: item.name,
      type: input.data.itemType,
      img: item.img,
      system: item.system,
      _id: null
    };

    if (item._id) {
      // This is an existing item that need to be updated
      achievement._id = item._id;
    }
    const effect = input.data.enchantment;
    effect.receptacleId = item.system.enchantments.capacities[0].id;
    const enchantments = {
      author: actor.name,
      year: input.date.year,
      season: input.date.season,
      bonuses: [],
      state: "lesser",
      aspects: item.system.enchantments.aspects,
      capacities: item.system.enchantments.capacities,
      effects: [effect]
    };

    achievement.system.enchantments = enchantments;
    achievement.system.state = "enchanted";
    return achievement;
  }

  activateListeners(html) {}
}

export class ChargedItem extends MinorEnchantment {
  constructor(lab, actor) {
    super(lab, actor, "chargedItem");
  }

  getDiaryDescription(planning) {
    return `${planning.data.receptacle.name}<br/>${planning.data.enchantment.name} (${
      planning.data.receptacle.system.enchantments.originalCharges
    }): ${planning.label}<br/>${game.i18n.localize("arm5e.sheet.labTotal")}: <b>${
      planning.labTotal.score
    }</b> <br/> ${planning.labTotal.label}`;
  }

  get hasWaste() {
    return false;
  }

  get hasVisCost() {
    return false;
  }

  get activitySheet() {
    return "systems/arm5e/templates/lab-activities/charged-item.html";
  }

  get title() {
    return game.i18n.localize("arm5e.lab.activity.chargedEnchantment");
  }

  validation(input) {
    let lvl = input.data.enchantment.system.level;
    let delta = input.labTotal.score - lvl;
    if (delta < lvl) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.notSkilledEnchant")
      };
    } else if (input.data.receptacle.system.enchantments.capacities[0].total * 10 < lvl) {
      return {
        valid: false,
        waste: delta,
        duration: 0,
        message: game.i18n.localize("arm5e.lab.planning.msg.smallCapacity")
      };
    } else {
      return {
        valid: true,
        waste: delta,
        duration: 1,
        message: game.i18n.format("arm5e.lab.planning.msg.chargesAvailable", {
          num: Math.ceil(delta / 5)
        })
      };
    }
  }

  prepareData(planning) {
    planning = super.prepareData(planning);

    planning.data.receptacle.system.enchantments.originalCharges = Math.max(
      1,
      Math.ceil((planning.labTotal.score - planning.data.enchantment.system.level) / 5)
    );

    return planning;
  }

  // TODO rework
  async activityAchievement(input) {
    const actor = await fromUuid(this.actorUuid);
    const item = input.data.receptacle;
    let chargesPerItem = item.system.enchantments.originalCharges;
    let quantity = 1;

    if (input.oneCharge) {
      quantity = chargesPerItem;
      chargesPerItem = 1;
    }

    const achievement = {
      name: item.name,
      type: input.data.itemType,
      img: item.img,
      system: item.system,
      _id: null
    };

    achievement.system.quantity = quantity;

    if (item._id) {
      // This is an existing item that need to be updated
      achievement._id = item._id;
    }

    const effect = input.data.enchantment;
    effect.receptacleId = item.system.enchantments.capacities[0].id;
    const enchantments = {
      author: actor.name,
      year: input.date.year,
      season: input.date.season,
      bonuses: [],
      state: "charged",
      originalCharges: chargesPerItem,
      charges: chargesPerItem,
      aspects: item.system.enchantments.aspects,
      capacities: item.system.enchantments.capacities,
      effects: [effect]
    };

    achievement.system.enchantments = enchantments;
    achievement.system.state = "enchanted";
    return achievement;
  }

  activateListeners(html) {}
}
