import { ArM5ePCActor } from "../actor/actor.js";
import ArM5eActiveEffect from "../helpers/active-effects.js";
import { getTopicDescription } from "../item/item-book-sheet.js";
import { ArM5eItem } from "../item/item.js";
import { debug, getDataset, log } from "../tools.js";

export class ScriptoriumObject {
  seasons = CONFIG.ARM5E.seasons;
  abilityKeysList = CONFIG.ARM5E.LOCALIZED_ABILITIES;
  arts = CONFIG.ARM5E.magic.arts;
  techs = CONFIG.ARM5E.magic.techniques;
  forms = CONFIG.ARM5E.magic.forms;
  bookTopics = CONFIG.ARM5E.books.categories;
  bookTypes = CONFIG.ARM5E.books.types;
  year = game.settings.get("arm5e", "currentDate").year;
  season = game.settings.get("arm5e", "currentDate").season;

  reading = {
    reader: { id: null },
    book: {
      id: null,
      uuid: null,
      name: game.i18n.localize("arm5e.activity.book.title"),
      system: {
        topics: [
          {
            category: "ability",
            type: "Summa",
            author: game.i18n.localize("arm5e.generic.unknown"),
            language: game.i18n.localize("arm5e.skill.commonCases.latin"),
            quality: 1,
            level: 1,
            key: "",
            option: "",
            spellName: "",
            art: "",
            spellTech: "cr",
            spellForm: "an",
            year: this.year,
            season: this.season
          }
        ],
        topicIndex: 0
      }
    }
  };
  writing = {
    writer: { id: null },
    book: {
      id: null,
      uuid: null,
      name: game.i18n.localize("arm5e.activity.book.title"),
      system: {
        topics: [
          {
            category: "ability",
            type: "Summa",
            author: game.i18n.localize("arm5e.generic.unknown"),
            language: game.i18n.localize("arm5e.skill.commonCases.latin"),
            quality: 1,
            level: 1,
            key: "",
            option: "",
            spellName: "",
            art: "",
            spellTech: "cr",
            spellForm: "an",
            year: this.year,
            season: this.season
          }
        ],
        topicIndex: 0
      }
    }
  };
}

export class Scriptorium extends FormApplication {
  constructor(data, options) {
    super(data, options);
    delete this.object.bookTopics.labText; // those are read in a lab
    // Hooks.on("closeApplication", (app, html) => this.onClose(app));
  }
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["arm5e", "sheet", "scriptorium-sheet"],
      title: "Scriptorium",
      template: "systems/arm5e/templates/generic/scriptorium.html",
      dragDrop: [
        { dragSelector: null, dropSelector: ".drop-book" },
        { dragSelector: null, dropSelector: ".drop-reader" },
        { dragSelector: null, dropSelector: ".drop-writer" }
      ],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "writing"
        }
      ],
      width: "600",
      height: "800",
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  onClose(app) {
    // if (app.object.reading.book.uuid != null) {
    //   fromUuidSync(app.object.reading.book.uuid).apps[app.appId] = undefined;
    // }
    if (app.object.reading.reader.id != null) {
      let reader = game.actors.get(app.object.reading.reader.id);
      delete reader.apps[app.appId];
    }
  }

  async _onDrop(event) {
    const dropData = TextEditor.getDragEventData(event);
    if (dropData.type == "Item" && event.currentTarget.dataset.drop === "book") {
      // if (this.item.system.activity === "teaching" || this.item.system.activity === "training") {
      const book = await Item.implementation.fromDropData(dropData);
      if (book.type === "book") {
        await this._setBook(book);
      }
    } else if (dropData.type == "Actor") {
      if (event.currentTarget.dataset.drop === "reader") {
        const reader = await Actor.implementation.fromDropData(dropData);
        if (reader.type === "player" || reader.type === "npc") {
          await this._setReader(reader);
        }
      } else if (event.currentTarget.dataset.drop === "writer") {
        const writer = await Actor.implementation.fromDropData(dropData);
        if (writer.type === "player" || writer.type === "npc") {
          await this._setWriter(writer);
        }
      }
    }
  }

  getUserCache() {
    let usercache = JSON.parse(sessionStorage.getItem(`usercache-${game.user.id}`));
    if (usercache[`scriptorium`] == undefined) {
      usercache[`scriptorium`] = {
        sections: {
          visibility: {
            scriptorium: {}
          }
        }
      };
    }

    sessionStorage.setItem(`usercache-${game.user.id}`, JSON.stringify(usercache));
    return usercache[`scriptorium`];
  }

  async getData(options = {}) {
    const context = foundry.utils.expandObject(await super.getData().object);
    context.error = false;
    context.ui = {
      ...this.getUserCache(),
      createPossible: "disabled",
      warning: "",
      warningParam: "",
      editItem: ""
    };
    let currentDate = game.settings.get("arm5e", "currentDate");
    context.curYear = currentDate.year;
    context.curSeason = currentDate.season;
    if (context.reading.book.uuid !== null) {
      context.ui.canEditBook = "readonly";
      context.ui.disabledBook = "disabled";
    }

    let maxLevel = 99;
    const topicIndex = Number(context.reading.book.system.topicIndex);
    // for convenience

    context.topicIndex = Number(topicIndex);
    const currentTopic = context.reading.book.system.topics[context.topicIndex];
    if (currentTopic.type === "Summa" || currentTopic.level) {
      maxLevel = currentTopic.level;
    }

    if (currentTopic.category == "mastery") {
      context.ui.disableType = "disabled";
    }

    context.reading.book.currentTopic = currentTopic;
    context.currentTopicNumber = context.topicIndex + 1 ?? 1;
    context.topicNum = context.reading.book.system.topics.length ?? 1;
    // new topic => writing
    context.newTopicIndex = context.writing.book.system.topicIndex;
    const newTopic = context.writing.book.system.topics[context.newTopicIndex];
    context.writing.book.newTopic = newTopic;

    if (currentTopic.category == "mastery") {
      context.ui.disableType = "disabled";
    }
    if (context.reading.reader?.id) {
      context.ui.canEditReader = "readonly";
      context.ui.disabledReader = "disabled";
      let reader = game.actors.get(context.reading.reader.id);
      context.reading.reader.name = reader.name;
      // get known languages
      context.reading.reader.languages = reader.system.abilities
        .filter((e) => {
          return (
            (e.system.key === "livingLanguage" || e.system.key === "deadLanguage") &&
            e.system.finalScore >= 4
          );
        })
        .map((lang) => {
          return { id: lang.id, name: lang.name, score: lang.system.finalScore };
        });

      // always get spell list to have at least one spell selected
      context.reading.reader.spells = reader.system.spells
        .filter((s) => {
          return (
            s.system.technique.value === currentTopic.spellTech &&
            s.system.form.value === currentTopic.spellForm
          );
        })
        .map((s) => {
          return {
            id: s.id,
            name: s.name,
            technique: s.system.technique.value,
            form: s.system.form.value
          };
        });
      switch (currentTopic.category) {
        case "ability": {
          let availableAbilities = duplicate(CONFIG.ARM5E.LOCALIZED_ABILITIES_ENRICHED);
          for (let a of reader.system.abilities) {
            let found = availableAbilities.findIndex(
              (e) => e.system.key == a.system.key && e.system.option == a.system.option
            );
            if (found >= 0) {
              availableAbilities[found]._id = a._id;
              availableAbilities[found].system.xp = a.system.xp;
              availableAbilities[found].secondaryId = false;
              availableAbilities[found].system.finalScore = a.system.finalScore;
            } else {
              availableAbilities.push({
                _id: a._id,
                secondaryId: true,
                name: a.name,
                system: {
                  key: a.system.key,
                  xp: a.system.xp,
                  finalScore: a.system.finalScore,
                  option: a.system.option,
                  category: a.system.category
                }
              });
            }
          }
          // reader.system.abilities.map((a) => {
          //   return {
          //     id: a.id,
          //     key: a.system.key,
          //     option: a.system.option,
          //     name: game.i18n.format(
          //       CONFIG.ARM5E.LOCALIZED_ABILITIES[a.system.key]
          //         ? CONFIG.ARM5E.LOCALIZED_ABILITIES[a.system.key].mnemonic
          //         : "Unknown",
          //       {
          //         option: a.system.option
          //       }
          //     ),
          //     score: a.system.finalScore
          //   };
          // });

          let filteredAbilities = availableAbilities.filter((a) => a.system.finalScore < maxLevel);
          // does the reader has the book topic ability?
          let ability = availableAbilities.find((a) => {
            return (
              a.system.key === currentTopic.key &&
              (currentTopic.option === null || a.system.option === currentTopic.option)
            );
          });

          if (ability) {
            // is the reader low skilled enough?
            if (filteredAbilities.find((a) => a._id == ability._id)) {
              context.reading.reader.ability = ability._id;
              context.reading.reader.abilities = [ability];
            } else {
              context.ui.editItem = "disabled";
              context.ui.warning = "arm5e.scriptorium.msg.tooSkilled";
              context.ui.warningParam = "";
              context.error = true;
            }
          } else {
            // check if the ability is not found because of the option field
            filteredAbilities = filteredAbilities.filter((a) => a.system.key == currentTopic.key);
            if (filteredAbilities.length > 0) {
              if (!context.reading.reader.ability) {
                context.reading.reader.ability = filteredAbilities[0]._id;
              }
              context.reading.reader.abilities = filteredAbilities;
              filteredAbilities[0].name = game.i18n.format(
                CONFIG.ARM5E.LOCALIZED_ABILITIES[currentTopic.key].mnemonic,
                { option: currentTopic.option }
              );
              if (filteredAbilities.length == 1) {
                context.ui.warning = "arm5e.scriptorium.msg.whichItem";
                context.ui.warningParam = game.i18n.localize("arm5e.sheet.ability");
              }
            } else {
              context.ui.editItem = "disabled";
              context.ui.warning = "arm5e.scriptorium.msg.missingItem";
              context.ui.warningParam = game.i18n.localize("arm5e.sheet.ability");
              context.error = true;
            }
            // else {
            //   context.ui.editItem = "disabled";
            //   context.ui.warning = "arm5e.scriptorium.msg.missingItem";
            //   context.ui.warningParam = game.i18n.localize("arm5e.sheet.ability");
            //   context.error = true;
            // }
            //context.error = true;
          }

          break;
        }
        case "art": {
          break;
        }
        case "mastery": {
          if (context.reading.reader.spells.length === 0) {
            context.ui.editItem = "disabled";
            context.ui.warning = "arm5e.scriptorium.msg.missingItem";
            context.ui.warningParam = game.i18n.localize("arm5e.sheet.spell");
            context.error = true;
          } else {
            if (!context.reading.reader.spell) {
              context.reading.reader.spell = context.reading.reader.spells[0].id;
            }
          }
          break;
        }
        case "labText": {
          context.ui.editItem = "disabled";
          context.ui.warning = "arm5e.scriptorium.msg.labText";
          context.error = true;
          break;
        }
        default:
          context.ui.warning = "Error";
          break;
      }
      this.checkReading(context, reader);
      log(false, `Scriptorium reading data: ${JSON.stringify(context.reading)}`);
    }

    ////////////////
    // WRITING section
    ///////////////
    if (context.writing.writer?.id) {
      if (newTopic.type === "Summa" || newTopic.level) {
        maxLevel = newTopic.level;
      }
      context.ui.canEditWriter = "readonly";
      context.ui.disabledWriter = "disabled";
      let writer = game.actors.get(context.writing.writer.id);
      const activeEffects = CONFIG.ISV10 ? writer.effects : writer.appliedEffects;
      context.writing.writer.writingBonus = 0;

      const writingEffects = ArM5eActiveEffect.findAllActiveEffectsWithTypeAndSubtypeFiltered(
        activeEffects,
        "activities",
        "writing"
      );
      for (const e of writingEffects) {
        context.writing.writer.writingBonus += e.changes.reduce(
          (res, current) => (res += Number(current.value)),
          context.writing.writer.writingBonus
        );
      }

      context.writing.writer.name = writer.name;
      // get known languages
      context.writing.writer.languages = writer.system.abilities
        .filter((e) => {
          return (
            (e.system.key === "livingLanguage" || e.system.key === "deadLanguage") &&
            e.system.finalScore >= 5
          );
        })
        .map((lang) => {
          return { id: lang.id, name: lang.name, score: lang.system.finalScore };
        });

      if (context.writing.writer.languages.length) {
        if (!context.writing.writer.language) {
          context.writing.writer.language = context.writing.writer.languages[0].id;
        }
        context.writing.writer.writingScore =
          writer.items.get(context.writing.writer.language).system.finalScore +
          writer.system.characteristics.com.value;
      } else {
        context.writing.writer.writingScore = 0;
      }

      // always get spell list to have at least one spell selected
      context.writing.writer.filteredSpells = writer.system.spells
        .filter((s) => {
          return s.system.finalScore >= 2;
        })
        .map((s) => {
          return {
            id: s.id,
            name: s.name,
            mastery: s.system.finalScore
          };
        });
      let qualityBonus = 0;
      let work = 0;
      switch (newTopic.category) {
        case "ability": {
          context.writing.filteredAbilities = writer.system.abilities.filter(
            (e) => e.system.finalScore >= 2
          );
          //
          //   context.writing.book.ability;
          if (context.writing.filteredAbilities.length) {
            if (!context.writing.writer.ability) {
              context.writing.writer.ability = context.writing.filteredAbilities[0]._id;
            }

            let ab = writer.items.get(context.writing.writer.ability);
            context.writing.book.system.topics[context.newTopicIndex].maxLevel = Math.round(
              ab.system.finalScore / 2
            );

            context.writing.book.system.topics[context.newTopicIndex].key = ab.system.key;
            context.writing.book.system.topics[context.newTopicIndex].option = ab.system.option;
            qualityBonus =
              (context.writing.book.system.topics[context.newTopicIndex].maxLevel -
                context.writing.book.system.topics[context.newTopicIndex].level) *
              3;
            // Adjust the level if it is above the max
            context.writing.book.system.topics[context.newTopicIndex].level = Math.min(
              context.writing.book.system.topics[context.newTopicIndex].level,
              context.writing.book.system.topics[context.newTopicIndex].maxLevel
            );
            work = context.writing.book.system.topics[context.newTopicIndex].level * 5;
          }
          log(false, `writer.ability: ${context.writing.writer.ability}`);
          break;
        }
        case "art": {
          let tech = Object.entries(writer.system.arts.techniques)
            .map((e) => {
              return {
                id: e[0],
                label: e[1].label,
                finalScore: e[1].finalScore
              };
            })
            .filter((e) => e.finalScore >= 5);
          let forms = Object.entries(writer.system.arts.forms)
            .map((e) => {
              return {
                id: e[0],
                label: e[1].label,
                finalScore: e[1].finalScore
              };
            })
            .filter((e) => e.finalScore >= 5);
          context.writing.filteredArts = tech.concat(forms);
          if (context.writing.filteredArts.length) {
            if (!context.writing.writer.art) {
              context.writing.writer.art = context.writing.filteredArts[0].id;
            }
            context.writing.book.system.topics[context.newTopicIndex].maxLevel = Math.round(
              writer.getArtScore(context.writing.writer.art).finalScore / 2
            );
            if (newTopic.type === "Summa") {
              qualityBonus =
                context.writing.book.system.topics[context.newTopicIndex].maxLevel -
                context.writing.book.system.topics[context.newTopicIndex].level;
              // Adjust the level if it is above the max
              context.writing.book.system.topics[context.newTopicIndex].level = Math.min(
                context.writing.book.system.topics[context.newTopicIndex].level,
                context.writing.book.system.topics[context.newTopicIndex].maxLevel
              );
              work = context.writing.book.system.topics[context.newTopicIndex].level;
            }
          }
          break;
        }
        case "mastery": {
          if (context.writing.writer.filteredSpells.length === 0) {
            context.ui.editItem = "disabled";
            context.ui.warning = "arm5e.scriptorium.msg.missingItem";
            context.ui.warningParam = game.i18n.localize("arm5e.sheet.spell");
            context.error = true;
          } else {
            if (!context.writing.writer.spell) {
              context.writing.writer.spell = context.writing.writer.filteredSpells[0].id;
            }
            let spell = context.writing.writer.filteredSpells.find(
              (e) => e.id == context.writing.writer.spell
            );
            context.writing.book.system.topics[context.newTopicIndex].maxLevel = Math.round(
              spell.mastery / 2
            );
            qualityBonus = 0;
          }
          break;
        }
      }
      // quality bonus cannot be higher than twice the original bonus
      context.writing.book.system.topics[context.newTopicIndex].quality = Math.min(
        2 * (writer.system.characteristics["com"].value + 6 + context.writing.writer.writingBonus),
        writer.system.characteristics["com"].value +
          6 +
          context.writing.writer.writingBonus +
          qualityBonus
      );

      if (newTopic.type === "Tractatus") {
        context.writing.writer.duration = 1;
      } else {
        context.writing.writer.duration = Math.ceil(work / context.writing.writer.writingScore);
      }
      this.checkWriting(context, writer);
      // log(false, `Scriptorium writing data: ${JSON.stringify(context.writing)}`);
    }

    if (context.error === false) {
      context.ui.createPossible = "";
    }

    log(false, `Scriptorium ui: ${JSON.stringify(context.ui)}`);
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".set-date").click(this.setDate.bind(this));
    html.find(".change-season").change(this._changeSeason.bind(this));
    html.find(".change-year").change(this._changeYear.bind(this));
    html.find(".book-topic").change(this._changeBookTopic.bind(this));
    html.find(".unlink-read-book").click(this._resetReadBook.bind(this));
    html.find(".unlink-reader").click(this._resetReader.bind(this));
    html.find(".create-reading-activity").click(this._createReadingDiaryEntry.bind(this));
    html.find(".create-writing-activity").click(this._createWritingDiaryEntry.bind(this));
    html.find(".section-handle").click(this._handle_section.bind(this));

    html.find(".next-topic").click(async (event) => this._changeCurrentTopic(event, 1));
    html.find(".previous-topic").click(async (event) => this._changeCurrentTopic(event, -1));
  }
  async _changeCurrentTopic(event, offset) {
    event.preventDefault();
    const newIndex = Number(getDataset(event).index) + offset;
    if (newIndex > this.object.reading.book.system.topics.length - 1 || newIndex < 0) {
      // no effect
      return;
    }
    // let updateData = ;
    // updateData["reading.book.system.topicIndex"] = newIndex;
    await this.submit({
      preventClose: true,
      updateData: { "reading.book.system.topicIndex": newIndex }
    });
  }
  async _handle_section(ev) {
    const dataset = getDataset(ev);
    log(false, `DEBUG section: ${dataset.section}, category: ${dataset.category}`);
    let usercache = JSON.parse(sessionStorage.getItem(`usercache-${game.user.id}`));
    let scope = usercache["scriptorium"].sections.visibility[dataset.category];
    let classes = document.getElementById(`${dataset.category}-${dataset.section}`).classList;
    if (scope) {
      if (classes.contains("hide")) {
        log(false, `DEBUG reveal ${dataset.section}`);
        scope[dataset.section] = "";
      } else {
        log(false, `DEBUG hide ${dataset.section}`);
        scope[dataset.section] = "hide";
      }
      sessionStorage.setItem(`usercache-${game.user.id}`, JSON.stringify(usercache));
    }
    // log(false, `DEBUG Flags: ${JSON.stringify(this.item.flags.arm5e.ui.sections.visibility)}`);
    classes.toggle("hide");
  }
  async _createWritingDiaryEntry(event) {
    const objectData = foundry.utils.expandObject(this.object);
    const writer = game.actors.get(objectData.writing.writer.id);

    const writerData = objectData.writing.writer;
    const book = objectData.writing.book;
    const dataset = event.currentTarget.dataset;
    const topic = book.system.topics[dataset.index];

    let activityName = game.i18n.format("arm5e.scriptorium.writing.activity", {
      title: book.name
    });

    topic.art = writerData.art;
    topic.author = writer.name;
    topic.language = writer.items.get(writerData.language).name;
    if (topic.category == "mastery" && writerData.spell) {
      const spell = writer.items.get(writerData.spell);
      topic.spellName = spell.name;
      topic.spellTech = spell.system.technique.value;
      topic.spellForm = spell.system.form.value;
    }

    const achievement = {
      name: book.name,
      type: "book",
      img: book.img,
      system: book.system,
      _id: null
    };

    const entryData = [
      {
        name: activityName,
        type: "diaryEntry",
        system: {
          cappedGain: false,
          dates: [{ season: objectData.season, year: Number(objectData.year), applied: false }],
          sourceQuality: 0,
          activity: "writing",
          done: false,
          progress: {
            abilities: [],
            arts: [],
            spells: [],
            newSpells: []
          },
          optionKey: "standard",
          duration: writerData.duration,
          description: game.i18n.format("arm5e.scriptorium.msg.diaryDescWriting", {
            name: writer.name,
            title: book.name,
            type: topic.type,
            language: topic.language,
            topic: getTopicDescription(topic)
          }),
          achievements: [achievement]
        }
      }
    ];
    let entry = await writer.createEmbeddedDocuments("Item", entryData, {});
    entry[0].sheet.render(true);
  }
  async _createReadingDiaryEntry(event) {
    const objectData = foundry.utils.expandObject(this.object);
    const reader = game.actors.get(objectData.reading.reader.id);
    const readerData = objectData.reading.reader;
    const book = objectData.reading.book;
    const dataset = event.currentTarget.dataset;
    const topic = book.system.topics[dataset.index];
    let activityName = game.i18n.format("arm5e.scriptorium.reading.activity", {
      title: book.name
    });

    const entryData = [
      {
        name: activityName,
        type: "diaryEntry",
        system: {
          cappedGain: false,
          dates: [{ season: objectData.season, year: Number(objectData.year), applied: false }],
          sourceQuality: topic.quality,
          activity: "reading",
          done: false,
          progress: {
            abilities: [],
            arts: [],
            spells: [],
            newSpells: []
          },
          optionKey: "standard",
          duration: 1,
          description: game.i18n.format("arm5e.scriptorium.msg.diaryDescReading", {
            name: reader.name,
            title: book.name,
            author: book.system.author,
            type: topic.type,
            language: book.system.language,
            topic: getTopicDescription(topic)
          })
        }
      }
    ];
    let quality = topic.quality;
    let maxLevel = 0;
    switch (topic.category) {
      case "ability":
        if (topic.type == "Summa") {
          objectData.ui = {};
          if (dataset.abilityId.length == 16) {
            let ab = reader.system.abilities.find((a) => {
              return a._id === dataset.abilityId;
            });
            entryData[0].system.cappedGain = this.checkAbilityOverload(objectData, reader, ab);
            if (entryData[0].system.cappedGain) {
              quality = topic.quality;
            }
          } else {
            entryData[0].system.cappedGain = false;
          }
          entryData[0].system.sourceQuality = quality;
          maxLevel = topic.level;
        }
        entryData[0].system.progress.abilities.push({
          id: dataset.abilityId,
          category: CONFIG.ARM5E.LOCALIZED_ABILITIES[topic.key]?.category ?? "general",
          name: game.i18n.format(CONFIG.ARM5E.LOCALIZED_ABILITIES[topic.key].mnemonic, {
            option: topic.option
          }),
          key: topic.key,
          option: topic.option,
          secondaryId: dataset.abilityId.length != 16,
          maxLevel: maxLevel,
          xp: entryData[0].system.cappedGain
            ? quality
            : quality + reader.system.bonuses.activities.reading
        });
        log(false, entryData[0].system.progress.abilities[0]);
        break;
      case "art":
        if (topic.type == "Summa") {
          let art = reader.getArtStats(topic.art);
          objectData.ui = {};
          entryData[0].system.cappedGain = this.checkArtOverload(objectData, reader, art);
          if (entryData[0].system.cappedGain) {
            quality = topic.quality;
          }
          entryData[0].system.sourceQuality = quality;
          maxLevel = topic.level;
        }
        entryData[0].system.progress.arts.push({
          key: topic.art,
          maxLevel: maxLevel,
          xp: entryData[0].system.cappedGain
            ? quality
            : quality + reader.system.bonuses.activities.reading
        });
        break;
      case "mastery":
        let readerSpell = reader.system.spells.find((s) => s.id === dataset.spellId);
        entryData[0].system.progress.spells.push({
          id: dataset.spellId,
          name: readerSpell.name,
          maxLevel: 0,
          form: readerSpell.system.form.value,
          xp: entryData[0].system.cappedGain
            ? quality
            : quality + reader.system.bonuses.activities.reading
        });
    }
    let entry = await reader.createEmbeddedDocuments("Item", entryData, {});
    entry[0].sheet.render(true);
  }

  async _resetReader(event) {
    let reader = game.actors.get(this.object.reading.reader.id);
    delete reader.apps[this.appId];
    let updatedData = {
      "reading.reader.id": null,
      "reading.reader.name": "",
      "reading.reader.ability": "",
      "reading.reader.spellName": "",
      "reading.reader.language": ""
    };
    await this.submit({
      preventClose: true,
      updateData: updatedData
    });
  }

  async _resetReadBook(event) {
    const objectData = foundry.utils.expandObject(this.object);
    const index = event.currentTarget.dataset.index;
    const singleTopic = objectData.reading.book.system.topics[index];
    singleTopic.level = singleTopic.type === "Tractatus" ? 0 : singleTopic.level;
    let updatedData = {
      "reading.book.id": null,
      "reading.book.uuid": null,
      "reading.book.system.topics": [singleTopic],
      "reading.book.system.topicIndex": 0
    };
    await this.submit({
      preventClose: true,
      updateData: updatedData
    });
  }

  async _changeSeason(event) {
    await this.submit({
      preventClose: true,
      updateData: { season: event.currentTarget.value }
    });
  }

  async _changeYear(event) {
    await this.submit({
      preventClose: true,
      updateData: { year: event.currentTarget.value }
    });
  }

  async _setBook(book) {
    log(false, "set book info");
    let index = book.getFlag("arm5e", "currentBookTopic") ?? 0;
    book.system.topicIndex = index;
    // book.apps[this.appId] = this;

    if (this.object.reading.reader.id) {
      log(false, "reader present");
    }
    await this.submit({
      preventClose: true,
      updateData: {
        ["reading.book"]: { name: book.name, id: book.id, uuid: book.uuid, system: book.system }
      }
    });
  }

  async _setReader(reader) {
    log(false, "set reader info");
    let readerInfo = {
      id: reader._id,
      name: reader.name
    };
    reader.apps[this.appId] = this;
    const readingData = { reader: readerInfo };
    await this.submit({
      preventClose: true,
      updateData: { reading: readingData }
    });
  }

  async _setWriter(writer) {
    log(false, "set writer info");
    let writerInfo = {
      id: writer._id,
      name: writer.name
    };
    writer.apps[this.appId] = this;
    const writingData = { writer: writerInfo };
    await this.submit({
      preventClose: true,
      updateData: { writing: writingData }
    });
  }

  async setDate(event) {
    event.preventDefault();
    const dataset = event.currentTarget.dataset;
    ui.notifications.info(
      game.i18n.format("arm5e.notification.setDate", {
        year: dataset.year,
        season: game.i18n.localize(CONFIG.ARM5E.seasons[dataset.season].label)
      })
    );
    await game.settings.set("arm5e", "currentDate", {
      year: dataset.year,
      season: dataset.season
    });
    this.render();
  }

  async _updateObject(event, formData) {
    const expanded = expandObject(formData);
    mergeObject(this.object, expanded, { recursive: true });
    this.render();
    // if (formData.season) {
    //   this.object.season = formData.season;
    // }
    // if (formData.year) {
    //   this.object.year = formData.year;
    // }
    // for (let [key, value] of Object.entries(formData)) {
    //   log(false, `Updated ${key} : ${value}`);
    //   this.object[key] = value;
    // }
    // this.object = foundry.utils.expandObject(this.object);
    // // log(false, `Scriptorium object: ${JSON.stringify(this.object)}`);
    // this.render();

    return;
  }

  async _changeBookTopic(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const activity = event.currentTarget.dataset.activity;
    let chosenTopic = $(`.book-topic.${activity}`).find("option:selected").val();
    const topicData = this.object[activity].book.system.topics[index];
    if (chosenTopic === "ability") {
      topicData.art = null;
      topicData.key = "awareness";
      topicData.option = "";
      topicData.spellName = null;
      topicData.category = "ability";
    } else if (chosenTopic === "art") {
      // missing data, reset to default
      topicData.art = "cr";
      topicData.key = null;
      topicData.option = "";
      topicData.spellName = null;
      topicData.category = "art";
    } else if (chosenTopic === "mastery") {
      topicData.art = null;
      topicData.key = null;
      topicData.option = "";
      topicData.spellName = "Mastered spell";
      topicData.category = "mastery";
      topicData.type = "Tractatus";
    } else {
      //TODO
    }
    await this.submit({
      preventClose: true,
      updateData: { [`${activity}.book.system.topics.${index}`]: topicData }
    });
    // log(false, `Book topic: ${item.system.topic}`);
  }

  checkWriting(context, writer) {
    const bookData = context.writing.book;
    const topic = context.writing.book.system.topics[context.newTopicIndex];
    // is the character able to  read?
    let writingSkill = writer.getAbilityStats("artesLib");
    if (writingSkill.score == 0) {
      context.ui.warning = "arm5e.scriptorium.msg.illiterate";
      context.ui.warningParam = "";
      context.error = true;
    }
    // know any language at proper level?
    if (context.writing.writer.languages.length == 0) {
      context.ui.warning = "arm5e.scriptorium.msg.noLanguage";
      context.ui.warningParam = "";
      context.error = true;
    }
  }

  checkReading(context, reader) {
    const bookData = context.reading.book;
    const currentTopic = context.reading.book.system.topics[context.topicIndex];
    // is the character able to  read?
    let readingSkill = reader.getAbilityStats("artesLib");
    if (readingSkill.score == 0) {
      context.ui.warning = "arm5e.scriptorium.msg.illiterate";
      context.ui.warningParam = "";
      context.error = true;
    }
    // know any language at proper level?
    if (context.reading.reader.languages.length == 0) {
      context.ui.warning = "arm5e.scriptorium.msg.noLanguage";
      context.ui.warningParam = "";
      context.error = true;
    }
    if (currentTopic.type === "Summa") {
      if (Number.isNaN(currentTopic.level) || currentTopic.level < 1) {
        context.ui.warning = "arm5e.scriptorium.msg.invalidLevel";
        context.ui.warningParam = "";
        context.error = true;
      }
    }
    if (Number.isNaN(currentTopic.quality) || currentTopic.quality < 1) {
      context.ui.warning = "arm5e.scriptorium.msg.invalidQuality";
      context.ui.warningParam = "";
      context.error = true;
    }

    switch (currentTopic.category) {
      case "ability": {
        if (currentTopic.type === "Summa") {
          let ab = reader.system.abilities.find((a) => {
            return a._id === context.reading.reader.ability;
          });
          if (ab?.system.finalscore >= currentTopic.level) {
            context.ui.warning = "arm5e.scriptorium.msg.tooSkilled";
            context.ui.warningParam = "";
            context.error = true;
          } else if (ab) {
            this.checkAbilityOverload(context, reader, ab);
          }
        }
        break;
      }
      case "art": {
        if (!reader._isMagus()) {
          context.ui.warning = "arm5e.scriptorium.msg.notMagus";
          context.ui.warningParam = "";
          context.error = true;
        }
        if (currentTopic.type === "Summa") {
          let art = reader.getArtStats(currentTopic.art);
          if (art.finalscore >= currentTopic.level) {
            context.ui.warning = "arm5e.scriptorium.msg.tooSkilled";
            context.ui.warningParam = "";
            context.error = true;
          } else {
            this.checkArtOverload(context, reader, art);
          }
        }
        break;
      }
      case "mastery":
        if (!reader._isMagus()) {
          context.ui.warning = "arm5e.scriptorium.msg.notMagus";
          context.ui.warningParam = "";
          context.error = true;
        }
        break;
    }
  }

  checkArtOverload(context, reader, artStat) {
    // let artStat = reader.getArtStats();
    const coeff = artStat.xpCoeff;
    const currentTopic = context.reading.book.system.topics[context.reading.book.system.topicIndex];
    let newXp =
      (currentTopic.quality + reader.system.bonuses.activities.reading + artStat.xp) * coeff;
    let maxXp = ArM5ePCActor.getArtXp(currentTopic.level);
    if (newXp > maxXp) {
      let newSource = maxXp - artStat.xp;
      currentTopic.theoriticalQuality = currentTopic.quality;
      currentTopic.quality = newSource > 0 ? newSource : 0;
      context.ui.warningParam = currentTopic.quality;
      context.ui.warning = "arm5e.scriptorium.msg.cappedQuality";
      return true;
    }
    return false;
  }

  checkAbilityOverload(context, reader, ability) {
    // let artStat = reader.getArtStats();
    const coeff = ability.system.xpCoeff;
    const currentTopic = context.reading.book.system.topics[context.reading.book.system.topicIndex];
    let newXp =
      (currentTopic.quality + reader.system.bonuses.activities.reading + ability.system.xp) * coeff;
    let maxXp = ArM5ePCActor.getAbilityXp(currentTopic.level);
    if (newXp > maxXp) {
      let newSource = maxXp - ability.system.xp;
      currentTopic.theoriticalQuality = currentTopic.quality;
      currentTopic.quality = newSource > 0 ? newSource : 0;
      context.ui.warningParam = currentTopic.quality;
      context.ui.warning = "arm5e.scriptorium.msg.cappedQuality";
      return true;
    }
    return false;
  }
}
