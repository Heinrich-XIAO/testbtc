// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.endsWith("...")) {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0)
        return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map;
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group))
          result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("events").EventEmitter;
  var childProcess = __require("child_process");
  var path = __require("path");
  var fs = __require("fs");
  var process2 = __require("process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      this._outputConfiguration = {
        ...this._outputConfiguration,
        ...configuration
      };
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument?.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description)
        this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._collectValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise?.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent?.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(args) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg))
          return false;
        return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
      };
      let activeVariadicOption = null;
      let activeGroup = null;
      let i = 0;
      while (i < args.length || activeGroup) {
        const arg = activeGroup ?? args[i++];
        activeGroup = null;
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args.slice(i));
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args[i++];
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                value = args[i++];
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              activeGroup = `-${arg.slice(2)}`;
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            unknown.push(...args.slice(i));
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg, ...args.slice(i));
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg, ...args.slice(i));
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg, ...args.slice(i));
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined)
        return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined)
        return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined)
        return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading)
        option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup())
        cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null)
            this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description)
        this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// node_modules/bson/lib/bson.cjs
var require_bson = __commonJS((exports) => {
  var TypedArrayPrototypeGetSymbolToStringTag = (() => {
    const g = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag).get;
    return (value) => g.call(value);
  })();
  function isUint8Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === "Uint8Array";
  }
  function isAnyArrayBuffer(value) {
    return typeof value === "object" && value != null && Symbol.toStringTag in value && (value[Symbol.toStringTag] === "ArrayBuffer" || value[Symbol.toStringTag] === "SharedArrayBuffer");
  }
  function isRegExp(regexp2) {
    return regexp2 instanceof RegExp || Object.prototype.toString.call(regexp2) === "[object RegExp]";
  }
  function isMap(value) {
    return typeof value === "object" && value != null && Symbol.toStringTag in value && value[Symbol.toStringTag] === "Map";
  }
  function isDate(date) {
    return date instanceof Date || Object.prototype.toString.call(date) === "[object Date]";
  }
  function defaultInspect(x, _options) {
    return JSON.stringify(x, (k, v) => {
      if (typeof v === "bigint") {
        return { $numberLong: `${v}` };
      } else if (isMap(v)) {
        return Object.fromEntries(v);
      }
      return v;
    });
  }
  function getStylizeFunction(options) {
    const stylizeExists = options != null && typeof options === "object" && "stylize" in options && typeof options.stylize === "function";
    if (stylizeExists) {
      return options.stylize;
    }
  }
  var BSON_MAJOR_VERSION = 6;
  var BSON_VERSION_SYMBOL = Symbol.for("@@mdb.bson.version");
  var BSON_INT32_MAX = 2147483647;
  var BSON_INT32_MIN = -2147483648;
  var BSON_INT64_MAX = Math.pow(2, 63) - 1;
  var BSON_INT64_MIN = -Math.pow(2, 63);
  var JS_INT_MAX = Math.pow(2, 53);
  var JS_INT_MIN = -Math.pow(2, 53);
  var BSON_DATA_NUMBER = 1;
  var BSON_DATA_STRING = 2;
  var BSON_DATA_OBJECT = 3;
  var BSON_DATA_ARRAY = 4;
  var BSON_DATA_BINARY = 5;
  var BSON_DATA_UNDEFINED = 6;
  var BSON_DATA_OID = 7;
  var BSON_DATA_BOOLEAN = 8;
  var BSON_DATA_DATE = 9;
  var BSON_DATA_NULL = 10;
  var BSON_DATA_REGEXP = 11;
  var BSON_DATA_DBPOINTER = 12;
  var BSON_DATA_CODE = 13;
  var BSON_DATA_SYMBOL = 14;
  var BSON_DATA_CODE_W_SCOPE = 15;
  var BSON_DATA_INT = 16;
  var BSON_DATA_TIMESTAMP = 17;
  var BSON_DATA_LONG = 18;
  var BSON_DATA_DECIMAL128 = 19;
  var BSON_DATA_MIN_KEY = 255;
  var BSON_DATA_MAX_KEY = 127;
  var BSON_BINARY_SUBTYPE_DEFAULT = 0;
  var BSON_BINARY_SUBTYPE_UUID_NEW = 4;
  var BSONType = Object.freeze({
    double: 1,
    string: 2,
    object: 3,
    array: 4,
    binData: 5,
    undefined: 6,
    objectId: 7,
    bool: 8,
    date: 9,
    null: 10,
    regex: 11,
    dbPointer: 12,
    javascript: 13,
    symbol: 14,
    javascriptWithScope: 15,
    int: 16,
    timestamp: 17,
    long: 18,
    decimal: 19,
    minKey: -1,
    maxKey: 127
  });

  class BSONError extends Error {
    get bsonError() {
      return true;
    }
    get name() {
      return "BSONError";
    }
    constructor(message, options) {
      super(message, options);
    }
    static isBSONError(value) {
      return value != null && typeof value === "object" && "bsonError" in value && value.bsonError === true && "name" in value && "message" in value && "stack" in value;
    }
  }

  class BSONVersionError extends BSONError {
    get name() {
      return "BSONVersionError";
    }
    constructor() {
      super(`Unsupported BSON version, bson types must be from bson ${BSON_MAJOR_VERSION}.x.x`);
    }
  }

  class BSONRuntimeError extends BSONError {
    get name() {
      return "BSONRuntimeError";
    }
    constructor(message) {
      super(message);
    }
  }

  class BSONOffsetError extends BSONError {
    get name() {
      return "BSONOffsetError";
    }
    constructor(message, offset, options) {
      super(`${message}. offset: ${offset}`, options);
      this.offset = offset;
    }
  }
  var TextDecoderFatal;
  var TextDecoderNonFatal;
  function parseUtf8(buffer2, start, end, fatal) {
    if (fatal) {
      TextDecoderFatal ??= new TextDecoder("utf8", { fatal: true });
      try {
        return TextDecoderFatal.decode(buffer2.subarray(start, end));
      } catch (cause) {
        throw new BSONError("Invalid UTF-8 string in BSON document", { cause });
      }
    }
    TextDecoderNonFatal ??= new TextDecoder("utf8", { fatal: false });
    return TextDecoderNonFatal.decode(buffer2.subarray(start, end));
  }
  function tryReadBasicLatin(uint8array, start, end) {
    if (uint8array.length === 0) {
      return "";
    }
    const stringByteLength = end - start;
    if (stringByteLength === 0) {
      return "";
    }
    if (stringByteLength > 20) {
      return null;
    }
    if (stringByteLength === 1 && uint8array[start] < 128) {
      return String.fromCharCode(uint8array[start]);
    }
    if (stringByteLength === 2 && uint8array[start] < 128 && uint8array[start + 1] < 128) {
      return String.fromCharCode(uint8array[start]) + String.fromCharCode(uint8array[start + 1]);
    }
    if (stringByteLength === 3 && uint8array[start] < 128 && uint8array[start + 1] < 128 && uint8array[start + 2] < 128) {
      return String.fromCharCode(uint8array[start]) + String.fromCharCode(uint8array[start + 1]) + String.fromCharCode(uint8array[start + 2]);
    }
    const latinBytes = [];
    for (let i = start;i < end; i++) {
      const byte = uint8array[i];
      if (byte > 127) {
        return null;
      }
      latinBytes.push(byte);
    }
    return String.fromCharCode(...latinBytes);
  }
  function tryWriteBasicLatin(destination, source, offset) {
    if (source.length === 0)
      return 0;
    if (source.length > 25)
      return null;
    if (destination.length - offset < source.length)
      return null;
    for (let charOffset = 0, destinationOffset = offset;charOffset < source.length; charOffset++, destinationOffset++) {
      const char = source.charCodeAt(charOffset);
      if (char > 127)
        return null;
      destination[destinationOffset] = char;
    }
    return source.length;
  }
  function nodejsMathRandomBytes(byteLength) {
    return nodeJsByteUtils.fromNumberArray(Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256)));
  }
  var nodejsRandomBytes = (() => {
    try {
      return __require("crypto").randomBytes;
    } catch {
      return nodejsMathRandomBytes;
    }
  })();
  var nodeJsByteUtils = {
    toLocalBufferType(potentialBuffer) {
      if (Buffer.isBuffer(potentialBuffer)) {
        return potentialBuffer;
      }
      if (ArrayBuffer.isView(potentialBuffer)) {
        return Buffer.from(potentialBuffer.buffer, potentialBuffer.byteOffset, potentialBuffer.byteLength);
      }
      const stringTag = potentialBuffer?.[Symbol.toStringTag] ?? Object.prototype.toString.call(potentialBuffer);
      if (stringTag === "ArrayBuffer" || stringTag === "SharedArrayBuffer" || stringTag === "[object ArrayBuffer]" || stringTag === "[object SharedArrayBuffer]") {
        return Buffer.from(potentialBuffer);
      }
      throw new BSONError(`Cannot create Buffer from the passed potentialBuffer.`);
    },
    allocate(size) {
      return Buffer.alloc(size);
    },
    allocateUnsafe(size) {
      return Buffer.allocUnsafe(size);
    },
    equals(a, b) {
      return nodeJsByteUtils.toLocalBufferType(a).equals(b);
    },
    fromNumberArray(array) {
      return Buffer.from(array);
    },
    fromBase64(base64) {
      return Buffer.from(base64, "base64");
    },
    toBase64(buffer2) {
      return nodeJsByteUtils.toLocalBufferType(buffer2).toString("base64");
    },
    fromISO88591(codePoints) {
      return Buffer.from(codePoints, "binary");
    },
    toISO88591(buffer2) {
      return nodeJsByteUtils.toLocalBufferType(buffer2).toString("binary");
    },
    fromHex(hex) {
      return Buffer.from(hex, "hex");
    },
    toHex(buffer2) {
      return nodeJsByteUtils.toLocalBufferType(buffer2).toString("hex");
    },
    toUTF8(buffer2, start, end, fatal) {
      const basicLatin = end - start <= 20 ? tryReadBasicLatin(buffer2, start, end) : null;
      if (basicLatin != null) {
        return basicLatin;
      }
      const string = nodeJsByteUtils.toLocalBufferType(buffer2).toString("utf8", start, end);
      if (fatal) {
        for (let i = 0;i < string.length; i++) {
          if (string.charCodeAt(i) === 65533) {
            parseUtf8(buffer2, start, end, true);
            break;
          }
        }
      }
      return string;
    },
    utf8ByteLength(input) {
      return Buffer.byteLength(input, "utf8");
    },
    encodeUTF8Into(buffer2, source, byteOffset) {
      const latinBytesWritten = tryWriteBasicLatin(buffer2, source, byteOffset);
      if (latinBytesWritten != null) {
        return latinBytesWritten;
      }
      return nodeJsByteUtils.toLocalBufferType(buffer2).write(source, byteOffset, undefined, "utf8");
    },
    randomBytes: nodejsRandomBytes,
    swap32(buffer2) {
      return nodeJsByteUtils.toLocalBufferType(buffer2).swap32();
    }
  };
  function isReactNative() {
    const { navigator } = globalThis;
    return typeof navigator === "object" && navigator.product === "ReactNative";
  }
  function webMathRandomBytes(byteLength) {
    if (byteLength < 0) {
      throw new RangeError(`The argument 'byteLength' is invalid. Received ${byteLength}`);
    }
    return webByteUtils.fromNumberArray(Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256)));
  }
  var webRandomBytes = (() => {
    const { crypto } = globalThis;
    if (crypto != null && typeof crypto.getRandomValues === "function") {
      return (byteLength) => {
        return crypto.getRandomValues(webByteUtils.allocate(byteLength));
      };
    } else {
      if (isReactNative()) {
        const { console: console2 } = globalThis;
        console2?.warn?.("BSON: For React Native please polyfill crypto.getRandomValues, e.g. using: https://www.npmjs.com/package/react-native-get-random-values.");
      }
      return webMathRandomBytes;
    }
  })();
  var HEX_DIGIT = /(\d|[a-f])/i;
  var webByteUtils = {
    toLocalBufferType(potentialUint8array) {
      const stringTag = potentialUint8array?.[Symbol.toStringTag] ?? Object.prototype.toString.call(potentialUint8array);
      if (stringTag === "Uint8Array") {
        return potentialUint8array;
      }
      if (ArrayBuffer.isView(potentialUint8array)) {
        return new Uint8Array(potentialUint8array.buffer.slice(potentialUint8array.byteOffset, potentialUint8array.byteOffset + potentialUint8array.byteLength));
      }
      if (stringTag === "ArrayBuffer" || stringTag === "SharedArrayBuffer" || stringTag === "[object ArrayBuffer]" || stringTag === "[object SharedArrayBuffer]") {
        return new Uint8Array(potentialUint8array);
      }
      throw new BSONError(`Cannot make a Uint8Array from passed potentialBuffer.`);
    },
    allocate(size) {
      if (typeof size !== "number") {
        throw new TypeError(`The "size" argument must be of type number. Received ${String(size)}`);
      }
      return new Uint8Array(size);
    },
    allocateUnsafe(size) {
      return webByteUtils.allocate(size);
    },
    equals(a, b) {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      for (let i = 0;i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    },
    fromNumberArray(array) {
      return Uint8Array.from(array);
    },
    fromBase64(base64) {
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    },
    toBase64(uint8array) {
      return btoa(webByteUtils.toISO88591(uint8array));
    },
    fromISO88591(codePoints) {
      return Uint8Array.from(codePoints, (c) => c.charCodeAt(0) & 255);
    },
    toISO88591(uint8array) {
      return Array.from(Uint16Array.from(uint8array), (b) => String.fromCharCode(b)).join("");
    },
    fromHex(hex) {
      const evenLengthHex = hex.length % 2 === 0 ? hex : hex.slice(0, hex.length - 1);
      const buffer2 = [];
      for (let i = 0;i < evenLengthHex.length; i += 2) {
        const firstDigit = evenLengthHex[i];
        const secondDigit = evenLengthHex[i + 1];
        if (!HEX_DIGIT.test(firstDigit)) {
          break;
        }
        if (!HEX_DIGIT.test(secondDigit)) {
          break;
        }
        const hexDigit = Number.parseInt(`${firstDigit}${secondDigit}`, 16);
        buffer2.push(hexDigit);
      }
      return Uint8Array.from(buffer2);
    },
    toHex(uint8array) {
      return Array.from(uint8array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    toUTF8(uint8array, start, end, fatal) {
      const basicLatin = end - start <= 20 ? tryReadBasicLatin(uint8array, start, end) : null;
      if (basicLatin != null) {
        return basicLatin;
      }
      return parseUtf8(uint8array, start, end, fatal);
    },
    utf8ByteLength(input) {
      return new TextEncoder().encode(input).byteLength;
    },
    encodeUTF8Into(uint8array, source, byteOffset) {
      const bytes = new TextEncoder().encode(source);
      uint8array.set(bytes, byteOffset);
      return bytes.byteLength;
    },
    randomBytes: webRandomBytes,
    swap32(buffer2) {
      if (buffer2.length % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0;i < buffer2.length; i += 4) {
        const byte0 = buffer2[i];
        const byte1 = buffer2[i + 1];
        const byte2 = buffer2[i + 2];
        const byte3 = buffer2[i + 3];
        buffer2[i] = byte3;
        buffer2[i + 1] = byte2;
        buffer2[i + 2] = byte1;
        buffer2[i + 3] = byte0;
      }
      return buffer2;
    }
  };
  var hasGlobalBuffer = typeof Buffer === "function" && Buffer.prototype?._isBuffer !== true;
  var ByteUtils = hasGlobalBuffer ? nodeJsByteUtils : webByteUtils;

  class BSONValue {
    get [BSON_VERSION_SYMBOL]() {
      return BSON_MAJOR_VERSION;
    }
    [Symbol.for("nodejs.util.inspect.custom")](depth, options, inspect) {
      return this.inspect(depth, options, inspect);
    }
  }
  var FLOAT = new Float64Array(1);
  var FLOAT_BYTES = new Uint8Array(FLOAT.buffer, 0, 8);
  FLOAT[0] = -1;
  var isBigEndian = FLOAT_BYTES[7] === 0;
  var NumberUtils = {
    isBigEndian,
    getNonnegativeInt32LE(source, offset) {
      if (source[offset + 3] > 127) {
        throw new RangeError(`Size cannot be negative at offset: ${offset}`);
      }
      return source[offset] | source[offset + 1] << 8 | source[offset + 2] << 16 | source[offset + 3] << 24;
    },
    getInt32LE(source, offset) {
      return source[offset] | source[offset + 1] << 8 | source[offset + 2] << 16 | source[offset + 3] << 24;
    },
    getUint32LE(source, offset) {
      return source[offset] + source[offset + 1] * 256 + source[offset + 2] * 65536 + source[offset + 3] * 16777216;
    },
    getUint32BE(source, offset) {
      return source[offset + 3] + source[offset + 2] * 256 + source[offset + 1] * 65536 + source[offset] * 16777216;
    },
    getBigInt64LE(source, offset) {
      const hi = BigInt(source[offset + 4] + source[offset + 5] * 256 + source[offset + 6] * 65536 + (source[offset + 7] << 24));
      const lo = BigInt(source[offset] + source[offset + 1] * 256 + source[offset + 2] * 65536 + source[offset + 3] * 16777216);
      return (hi << BigInt(32)) + lo;
    },
    getFloat64LE: isBigEndian ? (source, offset) => {
      FLOAT_BYTES[7] = source[offset];
      FLOAT_BYTES[6] = source[offset + 1];
      FLOAT_BYTES[5] = source[offset + 2];
      FLOAT_BYTES[4] = source[offset + 3];
      FLOAT_BYTES[3] = source[offset + 4];
      FLOAT_BYTES[2] = source[offset + 5];
      FLOAT_BYTES[1] = source[offset + 6];
      FLOAT_BYTES[0] = source[offset + 7];
      return FLOAT[0];
    } : (source, offset) => {
      FLOAT_BYTES[0] = source[offset];
      FLOAT_BYTES[1] = source[offset + 1];
      FLOAT_BYTES[2] = source[offset + 2];
      FLOAT_BYTES[3] = source[offset + 3];
      FLOAT_BYTES[4] = source[offset + 4];
      FLOAT_BYTES[5] = source[offset + 5];
      FLOAT_BYTES[6] = source[offset + 6];
      FLOAT_BYTES[7] = source[offset + 7];
      return FLOAT[0];
    },
    setInt32BE(destination, offset, value) {
      destination[offset + 3] = value;
      value >>>= 8;
      destination[offset + 2] = value;
      value >>>= 8;
      destination[offset + 1] = value;
      value >>>= 8;
      destination[offset] = value;
      return 4;
    },
    setInt32LE(destination, offset, value) {
      destination[offset] = value;
      value >>>= 8;
      destination[offset + 1] = value;
      value >>>= 8;
      destination[offset + 2] = value;
      value >>>= 8;
      destination[offset + 3] = value;
      return 4;
    },
    setBigInt64LE(destination, offset, value) {
      const mask32bits = BigInt(4294967295);
      let lo = Number(value & mask32bits);
      destination[offset] = lo;
      lo >>= 8;
      destination[offset + 1] = lo;
      lo >>= 8;
      destination[offset + 2] = lo;
      lo >>= 8;
      destination[offset + 3] = lo;
      let hi = Number(value >> BigInt(32) & mask32bits);
      destination[offset + 4] = hi;
      hi >>= 8;
      destination[offset + 5] = hi;
      hi >>= 8;
      destination[offset + 6] = hi;
      hi >>= 8;
      destination[offset + 7] = hi;
      return 8;
    },
    setFloat64LE: isBigEndian ? (destination, offset, value) => {
      FLOAT[0] = value;
      destination[offset] = FLOAT_BYTES[7];
      destination[offset + 1] = FLOAT_BYTES[6];
      destination[offset + 2] = FLOAT_BYTES[5];
      destination[offset + 3] = FLOAT_BYTES[4];
      destination[offset + 4] = FLOAT_BYTES[3];
      destination[offset + 5] = FLOAT_BYTES[2];
      destination[offset + 6] = FLOAT_BYTES[1];
      destination[offset + 7] = FLOAT_BYTES[0];
      return 8;
    } : (destination, offset, value) => {
      FLOAT[0] = value;
      destination[offset] = FLOAT_BYTES[0];
      destination[offset + 1] = FLOAT_BYTES[1];
      destination[offset + 2] = FLOAT_BYTES[2];
      destination[offset + 3] = FLOAT_BYTES[3];
      destination[offset + 4] = FLOAT_BYTES[4];
      destination[offset + 5] = FLOAT_BYTES[5];
      destination[offset + 6] = FLOAT_BYTES[6];
      destination[offset + 7] = FLOAT_BYTES[7];
      return 8;
    }
  };

  class Binary extends BSONValue {
    get _bsontype() {
      return "Binary";
    }
    constructor(buffer2, subType) {
      super();
      if (!(buffer2 == null) && typeof buffer2 === "string" && !ArrayBuffer.isView(buffer2) && !isAnyArrayBuffer(buffer2) && !Array.isArray(buffer2)) {
        throw new BSONError("Binary can only be constructed from Uint8Array or number[]");
      }
      this.sub_type = subType ?? Binary.BSON_BINARY_SUBTYPE_DEFAULT;
      if (buffer2 == null) {
        this.buffer = ByteUtils.allocate(Binary.BUFFER_SIZE);
        this.position = 0;
      } else {
        this.buffer = Array.isArray(buffer2) ? ByteUtils.fromNumberArray(buffer2) : ByteUtils.toLocalBufferType(buffer2);
        this.position = this.buffer.byteLength;
      }
    }
    put(byteValue) {
      if (typeof byteValue === "string" && byteValue.length !== 1) {
        throw new BSONError("only accepts single character String");
      } else if (typeof byteValue !== "number" && byteValue.length !== 1)
        throw new BSONError("only accepts single character Uint8Array or Array");
      let decodedByte;
      if (typeof byteValue === "string") {
        decodedByte = byteValue.charCodeAt(0);
      } else if (typeof byteValue === "number") {
        decodedByte = byteValue;
      } else {
        decodedByte = byteValue[0];
      }
      if (decodedByte < 0 || decodedByte > 255) {
        throw new BSONError("only accepts number in a valid unsigned byte range 0-255");
      }
      if (this.buffer.byteLength > this.position) {
        this.buffer[this.position++] = decodedByte;
      } else {
        const newSpace = ByteUtils.allocate(Binary.BUFFER_SIZE + this.buffer.length);
        newSpace.set(this.buffer, 0);
        this.buffer = newSpace;
        this.buffer[this.position++] = decodedByte;
      }
    }
    write(sequence, offset) {
      offset = typeof offset === "number" ? offset : this.position;
      if (this.buffer.byteLength < offset + sequence.length) {
        const newSpace = ByteUtils.allocate(this.buffer.byteLength + sequence.length);
        newSpace.set(this.buffer, 0);
        this.buffer = newSpace;
      }
      if (ArrayBuffer.isView(sequence)) {
        this.buffer.set(ByteUtils.toLocalBufferType(sequence), offset);
        this.position = offset + sequence.byteLength > this.position ? offset + sequence.length : this.position;
      } else if (typeof sequence === "string") {
        throw new BSONError("input cannot be string");
      }
    }
    read(position, length) {
      length = length && length > 0 ? length : this.position;
      const end = position + length;
      return this.buffer.subarray(position, end > this.position ? this.position : end);
    }
    value() {
      return this.buffer.length === this.position ? this.buffer : this.buffer.subarray(0, this.position);
    }
    length() {
      return this.position;
    }
    toJSON() {
      return ByteUtils.toBase64(this.buffer.subarray(0, this.position));
    }
    toString(encoding) {
      if (encoding === "hex")
        return ByteUtils.toHex(this.buffer.subarray(0, this.position));
      if (encoding === "base64")
        return ByteUtils.toBase64(this.buffer.subarray(0, this.position));
      if (encoding === "utf8" || encoding === "utf-8")
        return ByteUtils.toUTF8(this.buffer, 0, this.position, false);
      return ByteUtils.toUTF8(this.buffer, 0, this.position, false);
    }
    toExtendedJSON(options) {
      options = options || {};
      if (this.sub_type === Binary.SUBTYPE_VECTOR) {
        validateBinaryVector(this);
      }
      const base64String = ByteUtils.toBase64(this.buffer);
      const subType = Number(this.sub_type).toString(16);
      if (options.legacy) {
        return {
          $binary: base64String,
          $type: subType.length === 1 ? "0" + subType : subType
        };
      }
      return {
        $binary: {
          base64: base64String,
          subType: subType.length === 1 ? "0" + subType : subType
        }
      };
    }
    toUUID() {
      if (this.sub_type === Binary.SUBTYPE_UUID) {
        return new UUID(this.buffer.subarray(0, this.position));
      }
      throw new BSONError(`Binary sub_type "${this.sub_type}" is not supported for converting to UUID. Only "${Binary.SUBTYPE_UUID}" is currently supported.`);
    }
    static createFromHexString(hex, subType) {
      return new Binary(ByteUtils.fromHex(hex), subType);
    }
    static createFromBase64(base64, subType) {
      return new Binary(ByteUtils.fromBase64(base64), subType);
    }
    static fromExtendedJSON(doc, options) {
      options = options || {};
      let data;
      let type;
      if ("$binary" in doc) {
        if (options.legacy && typeof doc.$binary === "string" && "$type" in doc) {
          type = doc.$type ? parseInt(doc.$type, 16) : 0;
          data = ByteUtils.fromBase64(doc.$binary);
        } else {
          if (typeof doc.$binary !== "string") {
            type = doc.$binary.subType ? parseInt(doc.$binary.subType, 16) : 0;
            data = ByteUtils.fromBase64(doc.$binary.base64);
          }
        }
      } else if ("$uuid" in doc) {
        type = 4;
        data = UUID.bytesFromString(doc.$uuid);
      }
      if (!data) {
        throw new BSONError(`Unexpected Binary Extended JSON format ${JSON.stringify(doc)}`);
      }
      return type === BSON_BINARY_SUBTYPE_UUID_NEW ? new UUID(data) : new Binary(data, type);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      const base64 = ByteUtils.toBase64(this.buffer.subarray(0, this.position));
      const base64Arg = inspect(base64, options);
      const subTypeArg = inspect(this.sub_type, options);
      return `Binary.createFromBase64(${base64Arg}, ${subTypeArg})`;
    }
    toInt8Array() {
      if (this.sub_type !== Binary.SUBTYPE_VECTOR) {
        throw new BSONError("Binary sub_type is not Vector");
      }
      if (this.buffer[0] !== Binary.VECTOR_TYPE.Int8) {
        throw new BSONError("Binary datatype field is not Int8");
      }
      validateBinaryVector(this);
      return new Int8Array(this.buffer.buffer.slice(this.buffer.byteOffset + 2, this.buffer.byteOffset + this.position));
    }
    toFloat32Array() {
      if (this.sub_type !== Binary.SUBTYPE_VECTOR) {
        throw new BSONError("Binary sub_type is not Vector");
      }
      if (this.buffer[0] !== Binary.VECTOR_TYPE.Float32) {
        throw new BSONError("Binary datatype field is not Float32");
      }
      validateBinaryVector(this);
      const floatBytes = new Uint8Array(this.buffer.buffer.slice(this.buffer.byteOffset + 2, this.buffer.byteOffset + this.position));
      if (NumberUtils.isBigEndian)
        ByteUtils.swap32(floatBytes);
      return new Float32Array(floatBytes.buffer);
    }
    toPackedBits() {
      if (this.sub_type !== Binary.SUBTYPE_VECTOR) {
        throw new BSONError("Binary sub_type is not Vector");
      }
      if (this.buffer[0] !== Binary.VECTOR_TYPE.PackedBit) {
        throw new BSONError("Binary datatype field is not packed bit");
      }
      validateBinaryVector(this);
      return new Uint8Array(this.buffer.buffer.slice(this.buffer.byteOffset + 2, this.buffer.byteOffset + this.position));
    }
    toBits() {
      if (this.sub_type !== Binary.SUBTYPE_VECTOR) {
        throw new BSONError("Binary sub_type is not Vector");
      }
      if (this.buffer[0] !== Binary.VECTOR_TYPE.PackedBit) {
        throw new BSONError("Binary datatype field is not packed bit");
      }
      validateBinaryVector(this);
      const byteCount = this.length() - 2;
      const bitCount = byteCount * 8 - this.buffer[1];
      const bits = new Int8Array(bitCount);
      for (let bitOffset = 0;bitOffset < bits.length; bitOffset++) {
        const byteOffset = bitOffset / 8 | 0;
        const byte = this.buffer[byteOffset + 2];
        const shift = 7 - bitOffset % 8;
        const bit = byte >> shift & 1;
        bits[bitOffset] = bit;
      }
      return bits;
    }
    static fromInt8Array(array) {
      const buffer2 = ByteUtils.allocate(array.byteLength + 2);
      buffer2[0] = Binary.VECTOR_TYPE.Int8;
      buffer2[1] = 0;
      const intBytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      buffer2.set(intBytes, 2);
      const bin = new this(buffer2, this.SUBTYPE_VECTOR);
      validateBinaryVector(bin);
      return bin;
    }
    static fromFloat32Array(array) {
      const binaryBytes = ByteUtils.allocate(array.byteLength + 2);
      binaryBytes[0] = Binary.VECTOR_TYPE.Float32;
      binaryBytes[1] = 0;
      const floatBytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      binaryBytes.set(floatBytes, 2);
      if (NumberUtils.isBigEndian)
        ByteUtils.swap32(new Uint8Array(binaryBytes.buffer, 2));
      const bin = new this(binaryBytes, this.SUBTYPE_VECTOR);
      validateBinaryVector(bin);
      return bin;
    }
    static fromPackedBits(array, padding = 0) {
      const buffer2 = ByteUtils.allocate(array.byteLength + 2);
      buffer2[0] = Binary.VECTOR_TYPE.PackedBit;
      buffer2[1] = padding;
      buffer2.set(array, 2);
      const bin = new this(buffer2, this.SUBTYPE_VECTOR);
      validateBinaryVector(bin);
      return bin;
    }
    static fromBits(bits) {
      const byteLength = bits.length + 7 >>> 3;
      const bytes = new Uint8Array(byteLength + 2);
      bytes[0] = Binary.VECTOR_TYPE.PackedBit;
      const remainder = bits.length % 8;
      bytes[1] = remainder === 0 ? 0 : 8 - remainder;
      for (let bitOffset = 0;bitOffset < bits.length; bitOffset++) {
        const byteOffset = bitOffset >>> 3;
        const bit = bits[bitOffset];
        if (bit !== 0 && bit !== 1) {
          throw new BSONError(`Invalid bit value at ${bitOffset}: must be 0 or 1, found ${bits[bitOffset]}`);
        }
        if (bit === 0)
          continue;
        const shift = 7 - bitOffset % 8;
        bytes[byteOffset + 2] |= bit << shift;
      }
      return new this(bytes, Binary.SUBTYPE_VECTOR);
    }
  }
  Binary.BSON_BINARY_SUBTYPE_DEFAULT = 0;
  Binary.BUFFER_SIZE = 256;
  Binary.SUBTYPE_DEFAULT = 0;
  Binary.SUBTYPE_FUNCTION = 1;
  Binary.SUBTYPE_BYTE_ARRAY = 2;
  Binary.SUBTYPE_UUID_OLD = 3;
  Binary.SUBTYPE_UUID = 4;
  Binary.SUBTYPE_MD5 = 5;
  Binary.SUBTYPE_ENCRYPTED = 6;
  Binary.SUBTYPE_COLUMN = 7;
  Binary.SUBTYPE_SENSITIVE = 8;
  Binary.SUBTYPE_VECTOR = 9;
  Binary.SUBTYPE_USER_DEFINED = 128;
  Binary.VECTOR_TYPE = Object.freeze({
    Int8: 3,
    Float32: 39,
    PackedBit: 16
  });
  function validateBinaryVector(vector) {
    if (vector.sub_type !== Binary.SUBTYPE_VECTOR)
      return;
    const size = vector.position;
    const datatype = vector.buffer[0];
    const padding = vector.buffer[1];
    if ((datatype === Binary.VECTOR_TYPE.Float32 || datatype === Binary.VECTOR_TYPE.Int8) && padding !== 0) {
      throw new BSONError("Invalid Vector: padding must be zero for int8 and float32 vectors");
    }
    if (datatype === Binary.VECTOR_TYPE.Float32) {
      if (size !== 0 && size - 2 !== 0 && (size - 2) % 4 !== 0) {
        throw new BSONError("Invalid Vector: Float32 vector must contain a multiple of 4 bytes");
      }
    }
    if (datatype === Binary.VECTOR_TYPE.PackedBit && padding !== 0 && size === 2) {
      throw new BSONError("Invalid Vector: padding must be zero for packed bit vectors that are empty");
    }
    if (datatype === Binary.VECTOR_TYPE.PackedBit && padding > 7) {
      throw new BSONError(`Invalid Vector: padding must be a value between 0 and 7. found: ${padding}`);
    }
  }
  var UUID_BYTE_LENGTH = 16;
  var UUID_WITHOUT_DASHES = /^[0-9A-F]{32}$/i;
  var UUID_WITH_DASHES = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

  class UUID extends Binary {
    constructor(input) {
      let bytes;
      if (input == null) {
        bytes = UUID.generate();
      } else if (input instanceof UUID) {
        bytes = ByteUtils.toLocalBufferType(new Uint8Array(input.buffer));
      } else if (ArrayBuffer.isView(input) && input.byteLength === UUID_BYTE_LENGTH) {
        bytes = ByteUtils.toLocalBufferType(input);
      } else if (typeof input === "string") {
        bytes = UUID.bytesFromString(input);
      } else {
        throw new BSONError("Argument passed in UUID constructor must be a UUID, a 16 byte Buffer or a 32/36 character hex string (dashes excluded/included, format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).");
      }
      super(bytes, BSON_BINARY_SUBTYPE_UUID_NEW);
    }
    get id() {
      return this.buffer;
    }
    set id(value) {
      this.buffer = value;
    }
    toHexString(includeDashes = true) {
      if (includeDashes) {
        return [
          ByteUtils.toHex(this.buffer.subarray(0, 4)),
          ByteUtils.toHex(this.buffer.subarray(4, 6)),
          ByteUtils.toHex(this.buffer.subarray(6, 8)),
          ByteUtils.toHex(this.buffer.subarray(8, 10)),
          ByteUtils.toHex(this.buffer.subarray(10, 16))
        ].join("-");
      }
      return ByteUtils.toHex(this.buffer);
    }
    toString(encoding) {
      if (encoding === "hex")
        return ByteUtils.toHex(this.id);
      if (encoding === "base64")
        return ByteUtils.toBase64(this.id);
      return this.toHexString();
    }
    toJSON() {
      return this.toHexString();
    }
    equals(otherId) {
      if (!otherId) {
        return false;
      }
      if (otherId instanceof UUID) {
        return ByteUtils.equals(otherId.id, this.id);
      }
      try {
        return ByteUtils.equals(new UUID(otherId).id, this.id);
      } catch {
        return false;
      }
    }
    toBinary() {
      return new Binary(this.id, Binary.SUBTYPE_UUID);
    }
    static generate() {
      const bytes = ByteUtils.randomBytes(UUID_BYTE_LENGTH);
      bytes[6] = bytes[6] & 15 | 64;
      bytes[8] = bytes[8] & 63 | 128;
      return bytes;
    }
    static isValid(input) {
      if (!input) {
        return false;
      }
      if (typeof input === "string") {
        return UUID.isValidUUIDString(input);
      }
      if (isUint8Array(input)) {
        return input.byteLength === UUID_BYTE_LENGTH;
      }
      return input._bsontype === "Binary" && input.sub_type === this.SUBTYPE_UUID && input.buffer.byteLength === 16;
    }
    static createFromHexString(hexString) {
      const buffer2 = UUID.bytesFromString(hexString);
      return new UUID(buffer2);
    }
    static createFromBase64(base64) {
      return new UUID(ByteUtils.fromBase64(base64));
    }
    static bytesFromString(representation) {
      if (!UUID.isValidUUIDString(representation)) {
        throw new BSONError("UUID string representation must be 32 hex digits or canonical hyphenated representation");
      }
      return ByteUtils.fromHex(representation.replace(/-/g, ""));
    }
    static isValidUUIDString(representation) {
      return UUID_WITHOUT_DASHES.test(representation) || UUID_WITH_DASHES.test(representation);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      return `new UUID(${inspect(this.toHexString(), options)})`;
    }
  }

  class Code extends BSONValue {
    get _bsontype() {
      return "Code";
    }
    constructor(code, scope) {
      super();
      this.code = code.toString();
      this.scope = scope ?? null;
    }
    toJSON() {
      if (this.scope != null) {
        return { code: this.code, scope: this.scope };
      }
      return { code: this.code };
    }
    toExtendedJSON() {
      if (this.scope) {
        return { $code: this.code, $scope: this.scope };
      }
      return { $code: this.code };
    }
    static fromExtendedJSON(doc) {
      return new Code(doc.$code, doc.$scope);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      let parametersString = inspect(this.code, options);
      const multiLineFn = parametersString.includes(`
`);
      if (this.scope != null) {
        parametersString += `,${multiLineFn ? `
` : " "}${inspect(this.scope, options)}`;
      }
      const endingNewline = multiLineFn && this.scope === null;
      return `new Code(${multiLineFn ? `
` : ""}${parametersString}${endingNewline ? `
` : ""})`;
    }
  }
  function isDBRefLike(value) {
    return value != null && typeof value === "object" && "$id" in value && value.$id != null && "$ref" in value && typeof value.$ref === "string" && (!("$db" in value) || ("$db" in value) && typeof value.$db === "string");
  }

  class DBRef extends BSONValue {
    get _bsontype() {
      return "DBRef";
    }
    constructor(collection, oid, db, fields) {
      super();
      const parts = collection.split(".");
      if (parts.length === 2) {
        db = parts.shift();
        collection = parts.shift();
      }
      this.collection = collection;
      this.oid = oid;
      this.db = db;
      this.fields = fields || {};
    }
    get namespace() {
      return this.collection;
    }
    set namespace(value) {
      this.collection = value;
    }
    toJSON() {
      const o = Object.assign({
        $ref: this.collection,
        $id: this.oid
      }, this.fields);
      if (this.db != null)
        o.$db = this.db;
      return o;
    }
    toExtendedJSON(options) {
      options = options || {};
      let o = {
        $ref: this.collection,
        $id: this.oid
      };
      if (options.legacy) {
        return o;
      }
      if (this.db)
        o.$db = this.db;
      o = Object.assign(o, this.fields);
      return o;
    }
    static fromExtendedJSON(doc) {
      const copy = Object.assign({}, doc);
      delete copy.$ref;
      delete copy.$id;
      delete copy.$db;
      return new DBRef(doc.$ref, doc.$id, doc.$db, copy);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      const args = [
        inspect(this.namespace, options),
        inspect(this.oid, options),
        ...this.db ? [inspect(this.db, options)] : [],
        ...Object.keys(this.fields).length > 0 ? [inspect(this.fields, options)] : []
      ];
      args[1] = inspect === defaultInspect ? `new ObjectId(${args[1]})` : args[1];
      return `new DBRef(${args.join(", ")})`;
    }
  }
  function removeLeadingZerosAndExplicitPlus(str) {
    if (str === "") {
      return str;
    }
    let startIndex = 0;
    const isNegative = str[startIndex] === "-";
    const isExplicitlyPositive = str[startIndex] === "+";
    if (isExplicitlyPositive || isNegative) {
      startIndex += 1;
    }
    let foundInsignificantZero = false;
    for (;startIndex < str.length && str[startIndex] === "0"; ++startIndex) {
      foundInsignificantZero = true;
    }
    if (!foundInsignificantZero) {
      return isExplicitlyPositive ? str.slice(1) : str;
    }
    return `${isNegative ? "-" : ""}${str.length === startIndex ? "0" : str.slice(startIndex)}`;
  }
  function validateStringCharacters(str, radix) {
    radix = radix ?? 10;
    const validCharacters = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, radix);
    const regex = new RegExp(`[^-+${validCharacters}]`, "i");
    return regex.test(str) ? false : str;
  }
  var wasm = undefined;
  try {
    wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 2, 96, 0, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127, 3, 7, 6, 0, 1, 1, 1, 1, 1, 6, 6, 1, 127, 1, 65, 0, 11, 7, 50, 6, 3, 109, 117, 108, 0, 1, 5, 100, 105, 118, 95, 115, 0, 2, 5, 100, 105, 118, 95, 117, 0, 3, 5, 114, 101, 109, 95, 115, 0, 4, 5, 114, 101, 109, 95, 117, 0, 5, 8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0, 10, 191, 1, 6, 4, 0, 35, 0, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11])), {}).exports;
  } catch {}
  var TWO_PWR_16_DBL = 1 << 16;
  var TWO_PWR_24_DBL = 1 << 24;
  var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
  var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
  var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
  var INT_CACHE = {};
  var UINT_CACHE = {};
  var MAX_INT64_STRING_LENGTH = 20;
  var DECIMAL_REG_EX = /^(\+?0|(\+|-)?[1-9][0-9]*)$/;

  class Long extends BSONValue {
    get _bsontype() {
      return "Long";
    }
    get __isLong__() {
      return true;
    }
    constructor(lowOrValue = 0, highOrUnsigned, unsigned) {
      super();
      const unsignedBool = typeof highOrUnsigned === "boolean" ? highOrUnsigned : Boolean(unsigned);
      const high = typeof highOrUnsigned === "number" ? highOrUnsigned : 0;
      const res = typeof lowOrValue === "string" ? Long.fromString(lowOrValue, unsignedBool) : typeof lowOrValue === "bigint" ? Long.fromBigInt(lowOrValue, unsignedBool) : { low: lowOrValue | 0, high: high | 0, unsigned: unsignedBool };
      this.low = res.low;
      this.high = res.high;
      this.unsigned = res.unsigned;
    }
    static fromBits(lowBits, highBits, unsigned) {
      return new Long(lowBits, highBits, unsigned);
    }
    static fromInt(value, unsigned) {
      let obj, cachedObj, cache;
      if (unsigned) {
        value >>>= 0;
        if (cache = 0 <= value && value < 256) {
          cachedObj = UINT_CACHE[value];
          if (cachedObj)
            return cachedObj;
        }
        obj = Long.fromBits(value, (value | 0) < 0 ? -1 : 0, true);
        if (cache)
          UINT_CACHE[value] = obj;
        return obj;
      } else {
        value |= 0;
        if (cache = -128 <= value && value < 128) {
          cachedObj = INT_CACHE[value];
          if (cachedObj)
            return cachedObj;
        }
        obj = Long.fromBits(value, value < 0 ? -1 : 0, false);
        if (cache)
          INT_CACHE[value] = obj;
        return obj;
      }
    }
    static fromNumber(value, unsigned) {
      if (isNaN(value))
        return unsigned ? Long.UZERO : Long.ZERO;
      if (unsigned) {
        if (value < 0)
          return Long.UZERO;
        if (value >= TWO_PWR_64_DBL)
          return Long.MAX_UNSIGNED_VALUE;
      } else {
        if (value <= -9223372036854776000)
          return Long.MIN_VALUE;
        if (value + 1 >= TWO_PWR_63_DBL)
          return Long.MAX_VALUE;
      }
      if (value < 0)
        return Long.fromNumber(-value, unsigned).neg();
      return Long.fromBits(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0, unsigned);
    }
    static fromBigInt(value, unsigned) {
      const FROM_BIGINT_BIT_MASK = BigInt(4294967295);
      const FROM_BIGINT_BIT_SHIFT = BigInt(32);
      return new Long(Number(value & FROM_BIGINT_BIT_MASK), Number(value >> FROM_BIGINT_BIT_SHIFT & FROM_BIGINT_BIT_MASK), unsigned);
    }
    static _fromString(str, unsigned, radix) {
      if (str.length === 0)
        throw new BSONError("empty string");
      if (radix < 2 || 36 < radix)
        throw new BSONError("radix");
      let p;
      if ((p = str.indexOf("-")) > 0)
        throw new BSONError("interior hyphen");
      else if (p === 0) {
        return Long._fromString(str.substring(1), unsigned, radix).neg();
      }
      const radixToPower = Long.fromNumber(Math.pow(radix, 8));
      let result = Long.ZERO;
      for (let i = 0;i < str.length; i += 8) {
        const size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
        if (size < 8) {
          const power = Long.fromNumber(Math.pow(radix, size));
          result = result.mul(power).add(Long.fromNumber(value));
        } else {
          result = result.mul(radixToPower);
          result = result.add(Long.fromNumber(value));
        }
      }
      result.unsigned = unsigned;
      return result;
    }
    static fromStringStrict(str, unsignedOrRadix, radix) {
      let unsigned = false;
      if (typeof unsignedOrRadix === "number") {
        radix = unsignedOrRadix, unsignedOrRadix = false;
      } else {
        unsigned = !!unsignedOrRadix;
      }
      radix ??= 10;
      if (str.trim() !== str) {
        throw new BSONError(`Input: '${str}' contains leading and/or trailing whitespace`);
      }
      if (!validateStringCharacters(str, radix)) {
        throw new BSONError(`Input: '${str}' contains invalid characters for radix: ${radix}`);
      }
      const cleanedStr = removeLeadingZerosAndExplicitPlus(str);
      const result = Long._fromString(cleanedStr, unsigned, radix);
      if (result.toString(radix).toLowerCase() !== cleanedStr.toLowerCase()) {
        throw new BSONError(`Input: ${str} is not representable as ${result.unsigned ? "an unsigned" : "a signed"} 64-bit Long ${radix != null ? `with radix: ${radix}` : ""}`);
      }
      return result;
    }
    static fromString(str, unsignedOrRadix, radix) {
      let unsigned = false;
      if (typeof unsignedOrRadix === "number") {
        radix = unsignedOrRadix, unsignedOrRadix = false;
      } else {
        unsigned = !!unsignedOrRadix;
      }
      radix ??= 10;
      if (str === "NaN" && radix < 24) {
        return Long.ZERO;
      } else if ((str === "Infinity" || str === "+Infinity" || str === "-Infinity") && radix < 35) {
        return Long.ZERO;
      }
      return Long._fromString(str, unsigned, radix);
    }
    static fromBytes(bytes, unsigned, le) {
      return le ? Long.fromBytesLE(bytes, unsigned) : Long.fromBytesBE(bytes, unsigned);
    }
    static fromBytesLE(bytes, unsigned) {
      return new Long(bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24, bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24, unsigned);
    }
    static fromBytesBE(bytes, unsigned) {
      return new Long(bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7], bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], unsigned);
    }
    static isLong(value) {
      return value != null && typeof value === "object" && "__isLong__" in value && value.__isLong__ === true;
    }
    static fromValue(val, unsigned) {
      if (typeof val === "number")
        return Long.fromNumber(val, unsigned);
      if (typeof val === "string")
        return Long.fromString(val, unsigned);
      return Long.fromBits(val.low, val.high, typeof unsigned === "boolean" ? unsigned : val.unsigned);
    }
    add(addend) {
      if (!Long.isLong(addend))
        addend = Long.fromValue(addend);
      const a48 = this.high >>> 16;
      const a32 = this.high & 65535;
      const a16 = this.low >>> 16;
      const a00 = this.low & 65535;
      const b48 = addend.high >>> 16;
      const b32 = addend.high & 65535;
      const b16 = addend.low >>> 16;
      const b00 = addend.low & 65535;
      let c48 = 0, c32 = 0, c16 = 0, c00 = 0;
      c00 += a00 + b00;
      c16 += c00 >>> 16;
      c00 &= 65535;
      c16 += a16 + b16;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c32 += a32 + b32;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c48 += a48 + b48;
      c48 &= 65535;
      return Long.fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
    }
    and(other) {
      if (!Long.isLong(other))
        other = Long.fromValue(other);
      return Long.fromBits(this.low & other.low, this.high & other.high, this.unsigned);
    }
    compare(other) {
      if (!Long.isLong(other))
        other = Long.fromValue(other);
      if (this.eq(other))
        return 0;
      const thisNeg = this.isNegative(), otherNeg = other.isNegative();
      if (thisNeg && !otherNeg)
        return -1;
      if (!thisNeg && otherNeg)
        return 1;
      if (!this.unsigned)
        return this.sub(other).isNegative() ? -1 : 1;
      return other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1;
    }
    comp(other) {
      return this.compare(other);
    }
    divide(divisor) {
      if (!Long.isLong(divisor))
        divisor = Long.fromValue(divisor);
      if (divisor.isZero())
        throw new BSONError("division by zero");
      if (wasm) {
        if (!this.unsigned && this.high === -2147483648 && divisor.low === -1 && divisor.high === -1) {
          return this;
        }
        const low = (this.unsigned ? wasm.div_u : wasm.div_s)(this.low, this.high, divisor.low, divisor.high);
        return Long.fromBits(low, wasm.get_high(), this.unsigned);
      }
      if (this.isZero())
        return this.unsigned ? Long.UZERO : Long.ZERO;
      let approx, rem, res;
      if (!this.unsigned) {
        if (this.eq(Long.MIN_VALUE)) {
          if (divisor.eq(Long.ONE) || divisor.eq(Long.NEG_ONE))
            return Long.MIN_VALUE;
          else if (divisor.eq(Long.MIN_VALUE))
            return Long.ONE;
          else {
            const halfThis = this.shr(1);
            approx = halfThis.div(divisor).shl(1);
            if (approx.eq(Long.ZERO)) {
              return divisor.isNegative() ? Long.ONE : Long.NEG_ONE;
            } else {
              rem = this.sub(divisor.mul(approx));
              res = approx.add(rem.div(divisor));
              return res;
            }
          }
        } else if (divisor.eq(Long.MIN_VALUE))
          return this.unsigned ? Long.UZERO : Long.ZERO;
        if (this.isNegative()) {
          if (divisor.isNegative())
            return this.neg().div(divisor.neg());
          return this.neg().div(divisor).neg();
        } else if (divisor.isNegative())
          return this.div(divisor.neg()).neg();
        res = Long.ZERO;
      } else {
        if (!divisor.unsigned)
          divisor = divisor.toUnsigned();
        if (divisor.gt(this))
          return Long.UZERO;
        if (divisor.gt(this.shru(1)))
          return Long.UONE;
        res = Long.UZERO;
      }
      rem = this;
      while (rem.gte(divisor)) {
        approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
        const log2 = Math.ceil(Math.log(approx) / Math.LN2);
        const delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48);
        let approxRes = Long.fromNumber(approx);
        let approxRem = approxRes.mul(divisor);
        while (approxRem.isNegative() || approxRem.gt(rem)) {
          approx -= delta;
          approxRes = Long.fromNumber(approx, this.unsigned);
          approxRem = approxRes.mul(divisor);
        }
        if (approxRes.isZero())
          approxRes = Long.ONE;
        res = res.add(approxRes);
        rem = rem.sub(approxRem);
      }
      return res;
    }
    div(divisor) {
      return this.divide(divisor);
    }
    equals(other) {
      if (!Long.isLong(other))
        other = Long.fromValue(other);
      if (this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1)
        return false;
      return this.high === other.high && this.low === other.low;
    }
    eq(other) {
      return this.equals(other);
    }
    getHighBits() {
      return this.high;
    }
    getHighBitsUnsigned() {
      return this.high >>> 0;
    }
    getLowBits() {
      return this.low;
    }
    getLowBitsUnsigned() {
      return this.low >>> 0;
    }
    getNumBitsAbs() {
      if (this.isNegative()) {
        return this.eq(Long.MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
      }
      const val = this.high !== 0 ? this.high : this.low;
      let bit;
      for (bit = 31;bit > 0; bit--)
        if ((val & 1 << bit) !== 0)
          break;
      return this.high !== 0 ? bit + 33 : bit + 1;
    }
    greaterThan(other) {
      return this.comp(other) > 0;
    }
    gt(other) {
      return this.greaterThan(other);
    }
    greaterThanOrEqual(other) {
      return this.comp(other) >= 0;
    }
    gte(other) {
      return this.greaterThanOrEqual(other);
    }
    ge(other) {
      return this.greaterThanOrEqual(other);
    }
    isEven() {
      return (this.low & 1) === 0;
    }
    isNegative() {
      return !this.unsigned && this.high < 0;
    }
    isOdd() {
      return (this.low & 1) === 1;
    }
    isPositive() {
      return this.unsigned || this.high >= 0;
    }
    isZero() {
      return this.high === 0 && this.low === 0;
    }
    lessThan(other) {
      return this.comp(other) < 0;
    }
    lt(other) {
      return this.lessThan(other);
    }
    lessThanOrEqual(other) {
      return this.comp(other) <= 0;
    }
    lte(other) {
      return this.lessThanOrEqual(other);
    }
    modulo(divisor) {
      if (!Long.isLong(divisor))
        divisor = Long.fromValue(divisor);
      if (wasm) {
        const low = (this.unsigned ? wasm.rem_u : wasm.rem_s)(this.low, this.high, divisor.low, divisor.high);
        return Long.fromBits(low, wasm.get_high(), this.unsigned);
      }
      return this.sub(this.div(divisor).mul(divisor));
    }
    mod(divisor) {
      return this.modulo(divisor);
    }
    rem(divisor) {
      return this.modulo(divisor);
    }
    multiply(multiplier) {
      if (this.isZero())
        return Long.ZERO;
      if (!Long.isLong(multiplier))
        multiplier = Long.fromValue(multiplier);
      if (wasm) {
        const low = wasm.mul(this.low, this.high, multiplier.low, multiplier.high);
        return Long.fromBits(low, wasm.get_high(), this.unsigned);
      }
      if (multiplier.isZero())
        return Long.ZERO;
      if (this.eq(Long.MIN_VALUE))
        return multiplier.isOdd() ? Long.MIN_VALUE : Long.ZERO;
      if (multiplier.eq(Long.MIN_VALUE))
        return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
      if (this.isNegative()) {
        if (multiplier.isNegative())
          return this.neg().mul(multiplier.neg());
        else
          return this.neg().mul(multiplier).neg();
      } else if (multiplier.isNegative())
        return this.mul(multiplier.neg()).neg();
      if (this.lt(Long.TWO_PWR_24) && multiplier.lt(Long.TWO_PWR_24))
        return Long.fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);
      const a48 = this.high >>> 16;
      const a32 = this.high & 65535;
      const a16 = this.low >>> 16;
      const a00 = this.low & 65535;
      const b48 = multiplier.high >>> 16;
      const b32 = multiplier.high & 65535;
      const b16 = multiplier.low >>> 16;
      const b00 = multiplier.low & 65535;
      let c48 = 0, c32 = 0, c16 = 0, c00 = 0;
      c00 += a00 * b00;
      c16 += c00 >>> 16;
      c00 &= 65535;
      c16 += a16 * b00;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c16 += a00 * b16;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c32 += a32 * b00;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c32 += a16 * b16;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c32 += a00 * b32;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
      c48 &= 65535;
      return Long.fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
    }
    mul(multiplier) {
      return this.multiply(multiplier);
    }
    negate() {
      if (!this.unsigned && this.eq(Long.MIN_VALUE))
        return Long.MIN_VALUE;
      return this.not().add(Long.ONE);
    }
    neg() {
      return this.negate();
    }
    not() {
      return Long.fromBits(~this.low, ~this.high, this.unsigned);
    }
    notEquals(other) {
      return !this.equals(other);
    }
    neq(other) {
      return this.notEquals(other);
    }
    ne(other) {
      return this.notEquals(other);
    }
    or(other) {
      if (!Long.isLong(other))
        other = Long.fromValue(other);
      return Long.fromBits(this.low | other.low, this.high | other.high, this.unsigned);
    }
    shiftLeft(numBits) {
      if (Long.isLong(numBits))
        numBits = numBits.toInt();
      if ((numBits &= 63) === 0)
        return this;
      else if (numBits < 32)
        return Long.fromBits(this.low << numBits, this.high << numBits | this.low >>> 32 - numBits, this.unsigned);
      else
        return Long.fromBits(0, this.low << numBits - 32, this.unsigned);
    }
    shl(numBits) {
      return this.shiftLeft(numBits);
    }
    shiftRight(numBits) {
      if (Long.isLong(numBits))
        numBits = numBits.toInt();
      if ((numBits &= 63) === 0)
        return this;
      else if (numBits < 32)
        return Long.fromBits(this.low >>> numBits | this.high << 32 - numBits, this.high >> numBits, this.unsigned);
      else
        return Long.fromBits(this.high >> numBits - 32, this.high >= 0 ? 0 : -1, this.unsigned);
    }
    shr(numBits) {
      return this.shiftRight(numBits);
    }
    shiftRightUnsigned(numBits) {
      if (Long.isLong(numBits))
        numBits = numBits.toInt();
      numBits &= 63;
      if (numBits === 0)
        return this;
      else {
        const high = this.high;
        if (numBits < 32) {
          const low = this.low;
          return Long.fromBits(low >>> numBits | high << 32 - numBits, high >>> numBits, this.unsigned);
        } else if (numBits === 32)
          return Long.fromBits(high, 0, this.unsigned);
        else
          return Long.fromBits(high >>> numBits - 32, 0, this.unsigned);
      }
    }
    shr_u(numBits) {
      return this.shiftRightUnsigned(numBits);
    }
    shru(numBits) {
      return this.shiftRightUnsigned(numBits);
    }
    subtract(subtrahend) {
      if (!Long.isLong(subtrahend))
        subtrahend = Long.fromValue(subtrahend);
      return this.add(subtrahend.neg());
    }
    sub(subtrahend) {
      return this.subtract(subtrahend);
    }
    toInt() {
      return this.unsigned ? this.low >>> 0 : this.low;
    }
    toNumber() {
      if (this.unsigned)
        return (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0);
      return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
    }
    toBigInt() {
      return BigInt(this.toString());
    }
    toBytes(le) {
      return le ? this.toBytesLE() : this.toBytesBE();
    }
    toBytesLE() {
      const hi = this.high, lo = this.low;
      return [
        lo & 255,
        lo >>> 8 & 255,
        lo >>> 16 & 255,
        lo >>> 24,
        hi & 255,
        hi >>> 8 & 255,
        hi >>> 16 & 255,
        hi >>> 24
      ];
    }
    toBytesBE() {
      const hi = this.high, lo = this.low;
      return [
        hi >>> 24,
        hi >>> 16 & 255,
        hi >>> 8 & 255,
        hi & 255,
        lo >>> 24,
        lo >>> 16 & 255,
        lo >>> 8 & 255,
        lo & 255
      ];
    }
    toSigned() {
      if (!this.unsigned)
        return this;
      return Long.fromBits(this.low, this.high, false);
    }
    toString(radix) {
      radix = radix || 10;
      if (radix < 2 || 36 < radix)
        throw new BSONError("radix");
      if (this.isZero())
        return "0";
      if (this.isNegative()) {
        if (this.eq(Long.MIN_VALUE)) {
          const radixLong = Long.fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
          return div.toString(radix) + rem1.toInt().toString(radix);
        } else
          return "-" + this.neg().toString(radix);
      }
      const radixToPower = Long.fromNumber(Math.pow(radix, 6), this.unsigned);
      let rem = this;
      let result = "";
      while (true) {
        const remDiv = rem.div(radixToPower);
        const intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0;
        let digits = intval.toString(radix);
        rem = remDiv;
        if (rem.isZero()) {
          return digits + result;
        } else {
          while (digits.length < 6)
            digits = "0" + digits;
          result = "" + digits + result;
        }
      }
    }
    toUnsigned() {
      if (this.unsigned)
        return this;
      return Long.fromBits(this.low, this.high, true);
    }
    xor(other) {
      if (!Long.isLong(other))
        other = Long.fromValue(other);
      return Long.fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
    }
    eqz() {
      return this.isZero();
    }
    le(other) {
      return this.lessThanOrEqual(other);
    }
    toExtendedJSON(options) {
      if (options && options.relaxed)
        return this.toNumber();
      return { $numberLong: this.toString() };
    }
    static fromExtendedJSON(doc, options) {
      const { useBigInt64 = false, relaxed = true } = { ...options };
      if (doc.$numberLong.length > MAX_INT64_STRING_LENGTH) {
        throw new BSONError("$numberLong string is too long");
      }
      if (!DECIMAL_REG_EX.test(doc.$numberLong)) {
        throw new BSONError(`$numberLong string "${doc.$numberLong}" is in an invalid format`);
      }
      if (useBigInt64) {
        const bigIntResult = BigInt(doc.$numberLong);
        return BigInt.asIntN(64, bigIntResult);
      }
      const longResult = Long.fromString(doc.$numberLong);
      if (relaxed) {
        return longResult.toNumber();
      }
      return longResult;
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      const longVal = inspect(this.toString(), options);
      const unsignedVal = this.unsigned ? `, ${inspect(this.unsigned, options)}` : "";
      return `new Long(${longVal}${unsignedVal})`;
    }
  }
  Long.TWO_PWR_24 = Long.fromInt(TWO_PWR_24_DBL);
  Long.MAX_UNSIGNED_VALUE = Long.fromBits(4294967295 | 0, 4294967295 | 0, true);
  Long.ZERO = Long.fromInt(0);
  Long.UZERO = Long.fromInt(0, true);
  Long.ONE = Long.fromInt(1);
  Long.UONE = Long.fromInt(1, true);
  Long.NEG_ONE = Long.fromInt(-1);
  Long.MAX_VALUE = Long.fromBits(4294967295 | 0, 2147483647 | 0, false);
  Long.MIN_VALUE = Long.fromBits(0, 2147483648 | 0, false);
  var PARSE_STRING_REGEXP = /^(\+|-)?(\d+|(\d*\.\d*))?(E|e)?([-+])?(\d+)?$/;
  var PARSE_INF_REGEXP = /^(\+|-)?(Infinity|inf)$/i;
  var PARSE_NAN_REGEXP = /^(\+|-)?NaN$/i;
  var EXPONENT_MAX = 6111;
  var EXPONENT_MIN = -6176;
  var EXPONENT_BIAS = 6176;
  var MAX_DIGITS = 34;
  var NAN_BUFFER = ByteUtils.fromNumberArray([
    124,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ].reverse());
  var INF_NEGATIVE_BUFFER = ByteUtils.fromNumberArray([
    248,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ].reverse());
  var INF_POSITIVE_BUFFER = ByteUtils.fromNumberArray([
    120,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ].reverse());
  var EXPONENT_REGEX = /^([-+])?(\d+)?$/;
  var COMBINATION_MASK = 31;
  var EXPONENT_MASK = 16383;
  var COMBINATION_INFINITY = 30;
  var COMBINATION_NAN = 31;
  function isDigit(value) {
    return !isNaN(parseInt(value, 10));
  }
  function divideu128(value) {
    const DIVISOR = Long.fromNumber(1000 * 1000 * 1000);
    let _rem = Long.fromNumber(0);
    if (!value.parts[0] && !value.parts[1] && !value.parts[2] && !value.parts[3]) {
      return { quotient: value, rem: _rem };
    }
    for (let i = 0;i <= 3; i++) {
      _rem = _rem.shiftLeft(32);
      _rem = _rem.add(new Long(value.parts[i], 0));
      value.parts[i] = _rem.div(DIVISOR).low;
      _rem = _rem.modulo(DIVISOR);
    }
    return { quotient: value, rem: _rem };
  }
  function multiply64x2(left, right) {
    if (!left && !right) {
      return { high: Long.fromNumber(0), low: Long.fromNumber(0) };
    }
    const leftHigh = left.shiftRightUnsigned(32);
    const leftLow = new Long(left.getLowBits(), 0);
    const rightHigh = right.shiftRightUnsigned(32);
    const rightLow = new Long(right.getLowBits(), 0);
    let productHigh = leftHigh.multiply(rightHigh);
    let productMid = leftHigh.multiply(rightLow);
    const productMid2 = leftLow.multiply(rightHigh);
    let productLow = leftLow.multiply(rightLow);
    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
    productMid = new Long(productMid.getLowBits(), 0).add(productMid2).add(productLow.shiftRightUnsigned(32));
    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
    productLow = productMid.shiftLeft(32).add(new Long(productLow.getLowBits(), 0));
    return { high: productHigh, low: productLow };
  }
  function lessThan(left, right) {
    const uhleft = left.high >>> 0;
    const uhright = right.high >>> 0;
    if (uhleft < uhright) {
      return true;
    } else if (uhleft === uhright) {
      const ulleft = left.low >>> 0;
      const ulright = right.low >>> 0;
      if (ulleft < ulright)
        return true;
    }
    return false;
  }
  function invalidErr(string, message) {
    throw new BSONError(`"${string}" is not a valid Decimal128 string - ${message}`);
  }

  class Decimal128 extends BSONValue {
    get _bsontype() {
      return "Decimal128";
    }
    constructor(bytes) {
      super();
      if (typeof bytes === "string") {
        this.bytes = Decimal128.fromString(bytes).bytes;
      } else if (bytes instanceof Uint8Array || isUint8Array(bytes)) {
        if (bytes.byteLength !== 16) {
          throw new BSONError("Decimal128 must take a Buffer of 16 bytes");
        }
        this.bytes = bytes;
      } else {
        throw new BSONError("Decimal128 must take a Buffer or string");
      }
    }
    static fromString(representation) {
      return Decimal128._fromString(representation, { allowRounding: false });
    }
    static fromStringWithRounding(representation) {
      return Decimal128._fromString(representation, { allowRounding: true });
    }
    static _fromString(representation, options) {
      let isNegative = false;
      let sawSign = false;
      let sawRadix = false;
      let foundNonZero = false;
      let significantDigits = 0;
      let nDigitsRead = 0;
      let nDigits = 0;
      let radixPosition = 0;
      let firstNonZero = 0;
      const digits = [0];
      let nDigitsStored = 0;
      let digitsInsert = 0;
      let lastDigit = 0;
      let exponent = 0;
      let significandHigh = new Long(0, 0);
      let significandLow = new Long(0, 0);
      let biasedExponent = 0;
      let index = 0;
      if (representation.length >= 7000) {
        throw new BSONError("" + representation + " not a valid Decimal128 string");
      }
      const stringMatch = representation.match(PARSE_STRING_REGEXP);
      const infMatch = representation.match(PARSE_INF_REGEXP);
      const nanMatch = representation.match(PARSE_NAN_REGEXP);
      if (!stringMatch && !infMatch && !nanMatch || representation.length === 0) {
        throw new BSONError("" + representation + " not a valid Decimal128 string");
      }
      if (stringMatch) {
        const unsignedNumber = stringMatch[2];
        const e = stringMatch[4];
        const expSign = stringMatch[5];
        const expNumber = stringMatch[6];
        if (e && expNumber === undefined)
          invalidErr(representation, "missing exponent power");
        if (e && unsignedNumber === undefined)
          invalidErr(representation, "missing exponent base");
        if (e === undefined && (expSign || expNumber)) {
          invalidErr(representation, "missing e before exponent");
        }
      }
      if (representation[index] === "+" || representation[index] === "-") {
        sawSign = true;
        isNegative = representation[index++] === "-";
      }
      if (!isDigit(representation[index]) && representation[index] !== ".") {
        if (representation[index] === "i" || representation[index] === "I") {
          return new Decimal128(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER);
        } else if (representation[index] === "N") {
          return new Decimal128(NAN_BUFFER);
        }
      }
      while (isDigit(representation[index]) || representation[index] === ".") {
        if (representation[index] === ".") {
          if (sawRadix)
            invalidErr(representation, "contains multiple periods");
          sawRadix = true;
          index = index + 1;
          continue;
        }
        if (nDigitsStored < MAX_DIGITS) {
          if (representation[index] !== "0" || foundNonZero) {
            if (!foundNonZero) {
              firstNonZero = nDigitsRead;
            }
            foundNonZero = true;
            digits[digitsInsert++] = parseInt(representation[index], 10);
            nDigitsStored = nDigitsStored + 1;
          }
        }
        if (foundNonZero)
          nDigits = nDigits + 1;
        if (sawRadix)
          radixPosition = radixPosition + 1;
        nDigitsRead = nDigitsRead + 1;
        index = index + 1;
      }
      if (sawRadix && !nDigitsRead)
        throw new BSONError("" + representation + " not a valid Decimal128 string");
      if (representation[index] === "e" || representation[index] === "E") {
        const match = representation.substr(++index).match(EXPONENT_REGEX);
        if (!match || !match[2])
          return new Decimal128(NAN_BUFFER);
        exponent = parseInt(match[0], 10);
        index = index + match[0].length;
      }
      if (representation[index])
        return new Decimal128(NAN_BUFFER);
      if (!nDigitsStored) {
        digits[0] = 0;
        nDigits = 1;
        nDigitsStored = 1;
        significantDigits = 0;
      } else {
        lastDigit = nDigitsStored - 1;
        significantDigits = nDigits;
        if (significantDigits !== 1) {
          while (representation[firstNonZero + significantDigits - 1 + Number(sawSign) + Number(sawRadix)] === "0") {
            significantDigits = significantDigits - 1;
          }
        }
      }
      if (exponent <= radixPosition && radixPosition > exponent + (1 << 14)) {
        exponent = EXPONENT_MIN;
      } else {
        exponent = exponent - radixPosition;
      }
      while (exponent > EXPONENT_MAX) {
        lastDigit = lastDigit + 1;
        if (lastDigit >= MAX_DIGITS) {
          if (significantDigits === 0) {
            exponent = EXPONENT_MAX;
            break;
          }
          invalidErr(representation, "overflow");
        }
        exponent = exponent - 1;
      }
      if (options.allowRounding) {
        while (exponent < EXPONENT_MIN || nDigitsStored < nDigits) {
          if (lastDigit === 0 && significantDigits < nDigitsStored) {
            exponent = EXPONENT_MIN;
            significantDigits = 0;
            break;
          }
          if (nDigitsStored < nDigits) {
            nDigits = nDigits - 1;
          } else {
            lastDigit = lastDigit - 1;
          }
          if (exponent < EXPONENT_MAX) {
            exponent = exponent + 1;
          } else {
            const digitsString = digits.join("");
            if (digitsString.match(/^0+$/)) {
              exponent = EXPONENT_MAX;
              break;
            }
            invalidErr(representation, "overflow");
          }
        }
        if (lastDigit + 1 < significantDigits) {
          let endOfString = nDigitsRead;
          if (sawRadix) {
            firstNonZero = firstNonZero + 1;
            endOfString = endOfString + 1;
          }
          if (sawSign) {
            firstNonZero = firstNonZero + 1;
            endOfString = endOfString + 1;
          }
          const roundDigit = parseInt(representation[firstNonZero + lastDigit + 1], 10);
          let roundBit = 0;
          if (roundDigit >= 5) {
            roundBit = 1;
            if (roundDigit === 5) {
              roundBit = digits[lastDigit] % 2 === 1 ? 1 : 0;
              for (let i = firstNonZero + lastDigit + 2;i < endOfString; i++) {
                if (parseInt(representation[i], 10)) {
                  roundBit = 1;
                  break;
                }
              }
            }
          }
          if (roundBit) {
            let dIdx = lastDigit;
            for (;dIdx >= 0; dIdx--) {
              if (++digits[dIdx] > 9) {
                digits[dIdx] = 0;
                if (dIdx === 0) {
                  if (exponent < EXPONENT_MAX) {
                    exponent = exponent + 1;
                    digits[dIdx] = 1;
                  } else {
                    return new Decimal128(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER);
                  }
                }
              } else {
                break;
              }
            }
          }
        }
      } else {
        while (exponent < EXPONENT_MIN || nDigitsStored < nDigits) {
          if (lastDigit === 0) {
            if (significantDigits === 0) {
              exponent = EXPONENT_MIN;
              break;
            }
            invalidErr(representation, "exponent underflow");
          }
          if (nDigitsStored < nDigits) {
            if (representation[nDigits - 1 + Number(sawSign) + Number(sawRadix)] !== "0" && significantDigits !== 0) {
              invalidErr(representation, "inexact rounding");
            }
            nDigits = nDigits - 1;
          } else {
            if (digits[lastDigit] !== 0) {
              invalidErr(representation, "inexact rounding");
            }
            lastDigit = lastDigit - 1;
          }
          if (exponent < EXPONENT_MAX) {
            exponent = exponent + 1;
          } else {
            invalidErr(representation, "overflow");
          }
        }
        if (lastDigit + 1 < significantDigits) {
          if (sawRadix) {
            firstNonZero = firstNonZero + 1;
          }
          if (sawSign) {
            firstNonZero = firstNonZero + 1;
          }
          const roundDigit = parseInt(representation[firstNonZero + lastDigit + 1], 10);
          if (roundDigit !== 0) {
            invalidErr(representation, "inexact rounding");
          }
        }
      }
      significandHigh = Long.fromNumber(0);
      significandLow = Long.fromNumber(0);
      if (significantDigits === 0) {
        significandHigh = Long.fromNumber(0);
        significandLow = Long.fromNumber(0);
      } else if (lastDigit < 17) {
        let dIdx = 0;
        significandLow = Long.fromNumber(digits[dIdx++]);
        significandHigh = new Long(0, 0);
        for (;dIdx <= lastDigit; dIdx++) {
          significandLow = significandLow.multiply(Long.fromNumber(10));
          significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
        }
      } else {
        let dIdx = 0;
        significandHigh = Long.fromNumber(digits[dIdx++]);
        for (;dIdx <= lastDigit - 17; dIdx++) {
          significandHigh = significandHigh.multiply(Long.fromNumber(10));
          significandHigh = significandHigh.add(Long.fromNumber(digits[dIdx]));
        }
        significandLow = Long.fromNumber(digits[dIdx++]);
        for (;dIdx <= lastDigit; dIdx++) {
          significandLow = significandLow.multiply(Long.fromNumber(10));
          significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
        }
      }
      const significand = multiply64x2(significandHigh, Long.fromString("100000000000000000"));
      significand.low = significand.low.add(significandLow);
      if (lessThan(significand.low, significandLow)) {
        significand.high = significand.high.add(Long.fromNumber(1));
      }
      biasedExponent = exponent + EXPONENT_BIAS;
      const dec = { low: Long.fromNumber(0), high: Long.fromNumber(0) };
      if (significand.high.shiftRightUnsigned(49).and(Long.fromNumber(1)).equals(Long.fromNumber(1))) {
        dec.high = dec.high.or(Long.fromNumber(3).shiftLeft(61));
        dec.high = dec.high.or(Long.fromNumber(biasedExponent).and(Long.fromNumber(16383).shiftLeft(47)));
        dec.high = dec.high.or(significand.high.and(Long.fromNumber(140737488355327)));
      } else {
        dec.high = dec.high.or(Long.fromNumber(biasedExponent & 16383).shiftLeft(49));
        dec.high = dec.high.or(significand.high.and(Long.fromNumber(562949953421311)));
      }
      dec.low = significand.low;
      if (isNegative) {
        dec.high = dec.high.or(Long.fromString("9223372036854775808"));
      }
      const buffer2 = ByteUtils.allocateUnsafe(16);
      index = 0;
      buffer2[index++] = dec.low.low & 255;
      buffer2[index++] = dec.low.low >> 8 & 255;
      buffer2[index++] = dec.low.low >> 16 & 255;
      buffer2[index++] = dec.low.low >> 24 & 255;
      buffer2[index++] = dec.low.high & 255;
      buffer2[index++] = dec.low.high >> 8 & 255;
      buffer2[index++] = dec.low.high >> 16 & 255;
      buffer2[index++] = dec.low.high >> 24 & 255;
      buffer2[index++] = dec.high.low & 255;
      buffer2[index++] = dec.high.low >> 8 & 255;
      buffer2[index++] = dec.high.low >> 16 & 255;
      buffer2[index++] = dec.high.low >> 24 & 255;
      buffer2[index++] = dec.high.high & 255;
      buffer2[index++] = dec.high.high >> 8 & 255;
      buffer2[index++] = dec.high.high >> 16 & 255;
      buffer2[index++] = dec.high.high >> 24 & 255;
      return new Decimal128(buffer2);
    }
    toString() {
      let biased_exponent;
      let significand_digits = 0;
      const significand = new Array(36);
      for (let i = 0;i < significand.length; i++)
        significand[i] = 0;
      let index = 0;
      let is_zero = false;
      let significand_msb;
      let significand128 = { parts: [0, 0, 0, 0] };
      let j, k;
      const string = [];
      index = 0;
      const buffer2 = this.bytes;
      const low = buffer2[index++] | buffer2[index++] << 8 | buffer2[index++] << 16 | buffer2[index++] << 24;
      const midl = buffer2[index++] | buffer2[index++] << 8 | buffer2[index++] << 16 | buffer2[index++] << 24;
      const midh = buffer2[index++] | buffer2[index++] << 8 | buffer2[index++] << 16 | buffer2[index++] << 24;
      const high = buffer2[index++] | buffer2[index++] << 8 | buffer2[index++] << 16 | buffer2[index++] << 24;
      index = 0;
      const dec = {
        low: new Long(low, midl),
        high: new Long(midh, high)
      };
      if (dec.high.lessThan(Long.ZERO)) {
        string.push("-");
      }
      const combination = high >> 26 & COMBINATION_MASK;
      if (combination >> 3 === 3) {
        if (combination === COMBINATION_INFINITY) {
          return string.join("") + "Infinity";
        } else if (combination === COMBINATION_NAN) {
          return "NaN";
        } else {
          biased_exponent = high >> 15 & EXPONENT_MASK;
          significand_msb = 8 + (high >> 14 & 1);
        }
      } else {
        significand_msb = high >> 14 & 7;
        biased_exponent = high >> 17 & EXPONENT_MASK;
      }
      const exponent = biased_exponent - EXPONENT_BIAS;
      significand128.parts[0] = (high & 16383) + ((significand_msb & 15) << 14);
      significand128.parts[1] = midh;
      significand128.parts[2] = midl;
      significand128.parts[3] = low;
      if (significand128.parts[0] === 0 && significand128.parts[1] === 0 && significand128.parts[2] === 0 && significand128.parts[3] === 0) {
        is_zero = true;
      } else {
        for (k = 3;k >= 0; k--) {
          let least_digits = 0;
          const result = divideu128(significand128);
          significand128 = result.quotient;
          least_digits = result.rem.low;
          if (!least_digits)
            continue;
          for (j = 8;j >= 0; j--) {
            significand[k * 9 + j] = least_digits % 10;
            least_digits = Math.floor(least_digits / 10);
          }
        }
      }
      if (is_zero) {
        significand_digits = 1;
        significand[index] = 0;
      } else {
        significand_digits = 36;
        while (!significand[index]) {
          significand_digits = significand_digits - 1;
          index = index + 1;
        }
      }
      const scientific_exponent = significand_digits - 1 + exponent;
      if (scientific_exponent >= 34 || scientific_exponent <= -7 || exponent > 0) {
        if (significand_digits > 34) {
          string.push(`${0}`);
          if (exponent > 0)
            string.push(`E+${exponent}`);
          else if (exponent < 0)
            string.push(`E${exponent}`);
          return string.join("");
        }
        string.push(`${significand[index++]}`);
        significand_digits = significand_digits - 1;
        if (significand_digits) {
          string.push(".");
        }
        for (let i = 0;i < significand_digits; i++) {
          string.push(`${significand[index++]}`);
        }
        string.push("E");
        if (scientific_exponent > 0) {
          string.push(`+${scientific_exponent}`);
        } else {
          string.push(`${scientific_exponent}`);
        }
      } else {
        if (exponent >= 0) {
          for (let i = 0;i < significand_digits; i++) {
            string.push(`${significand[index++]}`);
          }
        } else {
          let radix_position = significand_digits + exponent;
          if (radix_position > 0) {
            for (let i = 0;i < radix_position; i++) {
              string.push(`${significand[index++]}`);
            }
          } else {
            string.push("0");
          }
          string.push(".");
          while (radix_position++ < 0) {
            string.push("0");
          }
          for (let i = 0;i < significand_digits - Math.max(radix_position - 1, 0); i++) {
            string.push(`${significand[index++]}`);
          }
        }
      }
      return string.join("");
    }
    toJSON() {
      return { $numberDecimal: this.toString() };
    }
    toExtendedJSON() {
      return { $numberDecimal: this.toString() };
    }
    static fromExtendedJSON(doc) {
      return Decimal128.fromString(doc.$numberDecimal);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      const d128string = inspect(this.toString(), options);
      return `new Decimal128(${d128string})`;
    }
  }

  class Double extends BSONValue {
    get _bsontype() {
      return "Double";
    }
    constructor(value) {
      super();
      if (value instanceof Number) {
        value = value.valueOf();
      }
      this.value = +value;
    }
    static fromString(value) {
      const coercedValue = Number(value);
      if (value === "NaN")
        return new Double(NaN);
      if (value === "Infinity")
        return new Double(Infinity);
      if (value === "-Infinity")
        return new Double(-Infinity);
      if (!Number.isFinite(coercedValue)) {
        throw new BSONError(`Input: ${value} is not representable as a Double`);
      }
      if (value.trim() !== value) {
        throw new BSONError(`Input: '${value}' contains whitespace`);
      }
      if (value === "") {
        throw new BSONError(`Input is an empty string`);
      }
      if (/[^-0-9.+eE]/.test(value)) {
        throw new BSONError(`Input: '${value}' is not in decimal or exponential notation`);
      }
      return new Double(coercedValue);
    }
    valueOf() {
      return this.value;
    }
    toJSON() {
      return this.value;
    }
    toString(radix) {
      return this.value.toString(radix);
    }
    toExtendedJSON(options) {
      if (options && (options.legacy || options.relaxed && isFinite(this.value))) {
        return this.value;
      }
      if (Object.is(Math.sign(this.value), -0)) {
        return { $numberDouble: "-0.0" };
      }
      return {
        $numberDouble: Number.isInteger(this.value) ? this.value.toFixed(1) : this.value.toString()
      };
    }
    static fromExtendedJSON(doc, options) {
      const doubleValue = parseFloat(doc.$numberDouble);
      return options && options.relaxed ? doubleValue : new Double(doubleValue);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      return `new Double(${inspect(this.value, options)})`;
    }
  }

  class Int32 extends BSONValue {
    get _bsontype() {
      return "Int32";
    }
    constructor(value) {
      super();
      if (value instanceof Number) {
        value = value.valueOf();
      }
      this.value = +value | 0;
    }
    static fromString(value) {
      const cleanedValue = removeLeadingZerosAndExplicitPlus(value);
      const coercedValue = Number(value);
      if (BSON_INT32_MAX < coercedValue) {
        throw new BSONError(`Input: '${value}' is larger than the maximum value for Int32`);
      } else if (BSON_INT32_MIN > coercedValue) {
        throw new BSONError(`Input: '${value}' is smaller than the minimum value for Int32`);
      } else if (!Number.isSafeInteger(coercedValue)) {
        throw new BSONError(`Input: '${value}' is not a safe integer`);
      } else if (coercedValue.toString() !== cleanedValue) {
        throw new BSONError(`Input: '${value}' is not a valid Int32 string`);
      }
      return new Int32(coercedValue);
    }
    valueOf() {
      return this.value;
    }
    toString(radix) {
      return this.value.toString(radix);
    }
    toJSON() {
      return this.value;
    }
    toExtendedJSON(options) {
      if (options && (options.relaxed || options.legacy))
        return this.value;
      return { $numberInt: this.value.toString() };
    }
    static fromExtendedJSON(doc, options) {
      return options && options.relaxed ? parseInt(doc.$numberInt, 10) : new Int32(doc.$numberInt);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      return `new Int32(${inspect(this.value, options)})`;
    }
  }

  class MaxKey extends BSONValue {
    get _bsontype() {
      return "MaxKey";
    }
    toExtendedJSON() {
      return { $maxKey: 1 };
    }
    static fromExtendedJSON() {
      return new MaxKey;
    }
    inspect() {
      return "new MaxKey()";
    }
  }

  class MinKey extends BSONValue {
    get _bsontype() {
      return "MinKey";
    }
    toExtendedJSON() {
      return { $minKey: 1 };
    }
    static fromExtendedJSON() {
      return new MinKey;
    }
    inspect() {
      return "new MinKey()";
    }
  }
  var PROCESS_UNIQUE = null;
  var __idCache = new WeakMap;

  class ObjectId extends BSONValue {
    get _bsontype() {
      return "ObjectId";
    }
    constructor(inputId) {
      super();
      let workingId;
      if (typeof inputId === "object" && inputId && "id" in inputId) {
        if (typeof inputId.id !== "string" && !ArrayBuffer.isView(inputId.id)) {
          throw new BSONError("Argument passed in must have an id that is of type string or Buffer");
        }
        if ("toHexString" in inputId && typeof inputId.toHexString === "function") {
          workingId = ByteUtils.fromHex(inputId.toHexString());
        } else {
          workingId = inputId.id;
        }
      } else {
        workingId = inputId;
      }
      if (workingId == null || typeof workingId === "number") {
        this.buffer = ObjectId.generate(typeof workingId === "number" ? workingId : undefined);
      } else if (ArrayBuffer.isView(workingId) && workingId.byteLength === 12) {
        this.buffer = ByteUtils.toLocalBufferType(workingId);
      } else if (typeof workingId === "string") {
        if (ObjectId.validateHexString(workingId)) {
          this.buffer = ByteUtils.fromHex(workingId);
          if (ObjectId.cacheHexString) {
            __idCache.set(this, workingId);
          }
        } else {
          throw new BSONError("input must be a 24 character hex string, 12 byte Uint8Array, or an integer");
        }
      } else {
        throw new BSONError("Argument passed in does not match the accepted types");
      }
    }
    get id() {
      return this.buffer;
    }
    set id(value) {
      this.buffer = value;
      if (ObjectId.cacheHexString) {
        __idCache.set(this, ByteUtils.toHex(value));
      }
    }
    static validateHexString(string) {
      if (string?.length !== 24)
        return false;
      for (let i = 0;i < 24; i++) {
        const char = string.charCodeAt(i);
        if (char >= 48 && char <= 57 || char >= 97 && char <= 102 || char >= 65 && char <= 70) {
          continue;
        }
        return false;
      }
      return true;
    }
    toHexString() {
      if (ObjectId.cacheHexString) {
        const __id = __idCache.get(this);
        if (__id)
          return __id;
      }
      const hexString = ByteUtils.toHex(this.id);
      if (ObjectId.cacheHexString) {
        __idCache.set(this, hexString);
      }
      return hexString;
    }
    static getInc() {
      return ObjectId.index = (ObjectId.index + 1) % 16777215;
    }
    static generate(time) {
      if (typeof time !== "number") {
        time = Math.floor(Date.now() / 1000);
      }
      const inc = ObjectId.getInc();
      const buffer2 = ByteUtils.allocateUnsafe(12);
      NumberUtils.setInt32BE(buffer2, 0, time);
      if (PROCESS_UNIQUE === null) {
        PROCESS_UNIQUE = ByteUtils.randomBytes(5);
      }
      buffer2[4] = PROCESS_UNIQUE[0];
      buffer2[5] = PROCESS_UNIQUE[1];
      buffer2[6] = PROCESS_UNIQUE[2];
      buffer2[7] = PROCESS_UNIQUE[3];
      buffer2[8] = PROCESS_UNIQUE[4];
      buffer2[11] = inc & 255;
      buffer2[10] = inc >> 8 & 255;
      buffer2[9] = inc >> 16 & 255;
      return buffer2;
    }
    toString(encoding) {
      if (encoding === "base64")
        return ByteUtils.toBase64(this.id);
      if (encoding === "hex")
        return this.toHexString();
      return this.toHexString();
    }
    toJSON() {
      return this.toHexString();
    }
    static is(variable) {
      return variable != null && typeof variable === "object" && "_bsontype" in variable && variable._bsontype === "ObjectId";
    }
    equals(otherId) {
      if (otherId === undefined || otherId === null) {
        return false;
      }
      if (ObjectId.is(otherId)) {
        return this.buffer[11] === otherId.buffer[11] && ByteUtils.equals(this.buffer, otherId.buffer);
      }
      if (typeof otherId === "string") {
        return otherId.toLowerCase() === this.toHexString();
      }
      if (typeof otherId === "object" && typeof otherId.toHexString === "function") {
        const otherIdString = otherId.toHexString();
        const thisIdString = this.toHexString();
        return typeof otherIdString === "string" && otherIdString.toLowerCase() === thisIdString;
      }
      return false;
    }
    getTimestamp() {
      const timestamp = new Date;
      const time = NumberUtils.getUint32BE(this.buffer, 0);
      timestamp.setTime(Math.floor(time) * 1000);
      return timestamp;
    }
    static createPk() {
      return new ObjectId;
    }
    serializeInto(uint8array, index) {
      uint8array[index] = this.buffer[0];
      uint8array[index + 1] = this.buffer[1];
      uint8array[index + 2] = this.buffer[2];
      uint8array[index + 3] = this.buffer[3];
      uint8array[index + 4] = this.buffer[4];
      uint8array[index + 5] = this.buffer[5];
      uint8array[index + 6] = this.buffer[6];
      uint8array[index + 7] = this.buffer[7];
      uint8array[index + 8] = this.buffer[8];
      uint8array[index + 9] = this.buffer[9];
      uint8array[index + 10] = this.buffer[10];
      uint8array[index + 11] = this.buffer[11];
      return 12;
    }
    static createFromTime(time) {
      const buffer2 = ByteUtils.allocate(12);
      for (let i = 11;i >= 4; i--)
        buffer2[i] = 0;
      NumberUtils.setInt32BE(buffer2, 0, time);
      return new ObjectId(buffer2);
    }
    static createFromHexString(hexString) {
      if (hexString?.length !== 24) {
        throw new BSONError("hex string must be 24 characters");
      }
      return new ObjectId(ByteUtils.fromHex(hexString));
    }
    static createFromBase64(base64) {
      if (base64?.length !== 16) {
        throw new BSONError("base64 string must be 16 characters");
      }
      return new ObjectId(ByteUtils.fromBase64(base64));
    }
    static isValid(id) {
      if (id == null)
        return false;
      if (typeof id === "string")
        return ObjectId.validateHexString(id);
      try {
        new ObjectId(id);
        return true;
      } catch {
        return false;
      }
    }
    toExtendedJSON() {
      if (this.toHexString)
        return { $oid: this.toHexString() };
      return { $oid: this.toString("hex") };
    }
    static fromExtendedJSON(doc) {
      return new ObjectId(doc.$oid);
    }
    isCached() {
      return ObjectId.cacheHexString && __idCache.has(this);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      return `new ObjectId(${inspect(this.toHexString(), options)})`;
    }
  }
  ObjectId.index = Math.floor(Math.random() * 16777215);
  function internalCalculateObjectSize(object, serializeFunctions, ignoreUndefined) {
    let totalLength = 4 + 1;
    if (Array.isArray(object)) {
      for (let i = 0;i < object.length; i++) {
        totalLength += calculateElement(i.toString(), object[i], serializeFunctions, true, ignoreUndefined);
      }
    } else {
      if (typeof object?.toBSON === "function") {
        object = object.toBSON();
      }
      for (const key of Object.keys(object)) {
        totalLength += calculateElement(key, object[key], serializeFunctions, false, ignoreUndefined);
      }
    }
    return totalLength;
  }
  function calculateElement(name, value, serializeFunctions = false, isArray = false, ignoreUndefined = false) {
    if (typeof value?.toBSON === "function") {
      value = value.toBSON();
    }
    switch (typeof value) {
      case "string":
        return 1 + ByteUtils.utf8ByteLength(name) + 1 + 4 + ByteUtils.utf8ByteLength(value) + 1;
      case "number":
        if (Math.floor(value) === value && value >= JS_INT_MIN && value <= JS_INT_MAX) {
          if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (4 + 1);
          } else {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);
          }
        } else {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);
        }
      case "undefined":
        if (isArray || !ignoreUndefined)
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1;
        return 0;
      case "boolean":
        return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (1 + 1);
      case "object":
        if (value != null && typeof value._bsontype === "string" && value[BSON_VERSION_SYMBOL] !== BSON_MAJOR_VERSION) {
          throw new BSONVersionError;
        } else if (value == null || value._bsontype === "MinKey" || value._bsontype === "MaxKey") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1;
        } else if (value._bsontype === "ObjectId") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (12 + 1);
        } else if (value instanceof Date || isDate(value)) {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);
        } else if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || isAnyArrayBuffer(value)) {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (1 + 4 + 1) + value.byteLength;
        } else if (value._bsontype === "Long" || value._bsontype === "Double" || value._bsontype === "Timestamp") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);
        } else if (value._bsontype === "Decimal128") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (16 + 1);
        } else if (value._bsontype === "Code") {
          if (value.scope != null && Object.keys(value.scope).length > 0) {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + 4 + 4 + ByteUtils.utf8ByteLength(value.code.toString()) + 1 + internalCalculateObjectSize(value.scope, serializeFunctions, ignoreUndefined);
          } else {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + 4 + ByteUtils.utf8ByteLength(value.code.toString()) + 1;
          }
        } else if (value._bsontype === "Binary") {
          const binary = value;
          if (binary.sub_type === Binary.SUBTYPE_BYTE_ARRAY) {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (binary.position + 1 + 4 + 1 + 4);
          } else {
            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (binary.position + 1 + 4 + 1);
          }
        } else if (value._bsontype === "Symbol") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + ByteUtils.utf8ByteLength(value.value) + 4 + 1 + 1;
        } else if (value._bsontype === "DBRef") {
          const ordered_values = Object.assign({
            $ref: value.collection,
            $id: value.oid
          }, value.fields);
          if (value.db != null) {
            ordered_values["$db"] = value.db;
          }
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + internalCalculateObjectSize(ordered_values, serializeFunctions, ignoreUndefined);
        } else if (value instanceof RegExp || isRegExp(value)) {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + ByteUtils.utf8ByteLength(value.source) + 1 + (value.global ? 1 : 0) + (value.ignoreCase ? 1 : 0) + (value.multiline ? 1 : 0) + 1;
        } else if (value._bsontype === "BSONRegExp") {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + ByteUtils.utf8ByteLength(value.pattern) + 1 + ByteUtils.utf8ByteLength(value.options) + 1;
        } else {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + internalCalculateObjectSize(value, serializeFunctions, ignoreUndefined) + 1;
        }
      case "function":
        if (serializeFunctions) {
          return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1 + 4 + ByteUtils.utf8ByteLength(value.toString()) + 1;
        }
        return 0;
      case "bigint":
        return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);
      case "symbol":
        return 0;
      default:
        throw new BSONError(`Unrecognized JS type: ${typeof value}`);
    }
  }
  function alphabetize(str) {
    return str.split("").sort().join("");
  }

  class BSONRegExp extends BSONValue {
    get _bsontype() {
      return "BSONRegExp";
    }
    constructor(pattern, options) {
      super();
      this.pattern = pattern;
      this.options = alphabetize(options ?? "");
      if (this.pattern.indexOf("\x00") !== -1) {
        throw new BSONError(`BSON Regex patterns cannot contain null bytes, found: ${JSON.stringify(this.pattern)}`);
      }
      if (this.options.indexOf("\x00") !== -1) {
        throw new BSONError(`BSON Regex options cannot contain null bytes, found: ${JSON.stringify(this.options)}`);
      }
      for (let i = 0;i < this.options.length; i++) {
        if (!(this.options[i] === "i" || this.options[i] === "m" || this.options[i] === "x" || this.options[i] === "l" || this.options[i] === "s" || this.options[i] === "u")) {
          throw new BSONError(`The regular expression option [${this.options[i]}] is not supported`);
        }
      }
    }
    static parseOptions(options) {
      return options ? options.split("").sort().join("") : "";
    }
    toExtendedJSON(options) {
      options = options || {};
      if (options.legacy) {
        return { $regex: this.pattern, $options: this.options };
      }
      return { $regularExpression: { pattern: this.pattern, options: this.options } };
    }
    static fromExtendedJSON(doc) {
      if ("$regex" in doc) {
        if (typeof doc.$regex !== "string") {
          if (doc.$regex._bsontype === "BSONRegExp") {
            return doc;
          }
        } else {
          return new BSONRegExp(doc.$regex, BSONRegExp.parseOptions(doc.$options));
        }
      }
      if ("$regularExpression" in doc) {
        return new BSONRegExp(doc.$regularExpression.pattern, BSONRegExp.parseOptions(doc.$regularExpression.options));
      }
      throw new BSONError(`Unexpected BSONRegExp EJSON object form: ${JSON.stringify(doc)}`);
    }
    inspect(depth, options, inspect) {
      const stylize = getStylizeFunction(options) ?? ((v) => v);
      inspect ??= defaultInspect;
      const pattern = stylize(inspect(this.pattern), "regexp");
      const flags = stylize(inspect(this.options), "regexp");
      return `new BSONRegExp(${pattern}, ${flags})`;
    }
  }

  class BSONSymbol extends BSONValue {
    get _bsontype() {
      return "BSONSymbol";
    }
    constructor(value) {
      super();
      this.value = value;
    }
    valueOf() {
      return this.value;
    }
    toString() {
      return this.value;
    }
    toJSON() {
      return this.value;
    }
    toExtendedJSON() {
      return { $symbol: this.value };
    }
    static fromExtendedJSON(doc) {
      return new BSONSymbol(doc.$symbol);
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      return `new BSONSymbol(${inspect(this.value, options)})`;
    }
  }
  var LongWithoutOverridesClass = Long;

  class Timestamp extends LongWithoutOverridesClass {
    get _bsontype() {
      return "Timestamp";
    }
    get i() {
      return this.low >>> 0;
    }
    get t() {
      return this.high >>> 0;
    }
    constructor(low) {
      if (low == null) {
        super(0, 0, true);
      } else if (typeof low === "bigint") {
        super(low, true);
      } else if (Long.isLong(low)) {
        super(low.low, low.high, true);
      } else if (typeof low === "object" && "t" in low && "i" in low) {
        if (typeof low.t !== "number" && (typeof low.t !== "object" || low.t._bsontype !== "Int32")) {
          throw new BSONError("Timestamp constructed from { t, i } must provide t as a number");
        }
        if (typeof low.i !== "number" && (typeof low.i !== "object" || low.i._bsontype !== "Int32")) {
          throw new BSONError("Timestamp constructed from { t, i } must provide i as a number");
        }
        const t = Number(low.t);
        const i = Number(low.i);
        if (t < 0 || Number.isNaN(t)) {
          throw new BSONError("Timestamp constructed from { t, i } must provide a positive t");
        }
        if (i < 0 || Number.isNaN(i)) {
          throw new BSONError("Timestamp constructed from { t, i } must provide a positive i");
        }
        if (t > 4294967295) {
          throw new BSONError("Timestamp constructed from { t, i } must provide t equal or less than uint32 max");
        }
        if (i > 4294967295) {
          throw new BSONError("Timestamp constructed from { t, i } must provide i equal or less than uint32 max");
        }
        super(i, t, true);
      } else {
        throw new BSONError("A Timestamp can only be constructed with: bigint, Long, or { t: number; i: number }");
      }
    }
    toJSON() {
      return {
        $timestamp: this.toString()
      };
    }
    static fromInt(value) {
      return new Timestamp(Long.fromInt(value, true));
    }
    static fromNumber(value) {
      return new Timestamp(Long.fromNumber(value, true));
    }
    static fromBits(lowBits, highBits) {
      return new Timestamp({ i: lowBits, t: highBits });
    }
    static fromString(str, optRadix) {
      return new Timestamp(Long.fromString(str, true, optRadix));
    }
    toExtendedJSON() {
      return { $timestamp: { t: this.t, i: this.i } };
    }
    static fromExtendedJSON(doc) {
      const i = Long.isLong(doc.$timestamp.i) ? doc.$timestamp.i.getLowBitsUnsigned() : doc.$timestamp.i;
      const t = Long.isLong(doc.$timestamp.t) ? doc.$timestamp.t.getLowBitsUnsigned() : doc.$timestamp.t;
      return new Timestamp({ t, i });
    }
    inspect(depth, options, inspect) {
      inspect ??= defaultInspect;
      const t = inspect(this.t, options);
      const i = inspect(this.i, options);
      return `new Timestamp({ t: ${t}, i: ${i} })`;
    }
  }
  Timestamp.MAX_VALUE = Long.MAX_UNSIGNED_VALUE;
  var JS_INT_MAX_LONG = Long.fromNumber(JS_INT_MAX);
  var JS_INT_MIN_LONG = Long.fromNumber(JS_INT_MIN);
  function internalDeserialize(buffer2, options, isArray) {
    options = options == null ? {} : options;
    const index = options && options.index ? options.index : 0;
    const size = NumberUtils.getInt32LE(buffer2, index);
    if (size < 5) {
      throw new BSONError(`bson size must be >= 5, is ${size}`);
    }
    if (options.allowObjectSmallerThanBufferSize && buffer2.length < size) {
      throw new BSONError(`buffer length ${buffer2.length} must be >= bson size ${size}`);
    }
    if (!options.allowObjectSmallerThanBufferSize && buffer2.length !== size) {
      throw new BSONError(`buffer length ${buffer2.length} must === bson size ${size}`);
    }
    if (size + index > buffer2.byteLength) {
      throw new BSONError(`(bson size ${size} + options.index ${index} must be <= buffer length ${buffer2.byteLength})`);
    }
    if (buffer2[index + size - 1] !== 0) {
      throw new BSONError("One object, sized correctly, with a spot for an EOO, but the EOO isn't 0x00");
    }
    return deserializeObject(buffer2, index, options, isArray);
  }
  var allowedDBRefKeys = /^\$ref$|^\$id$|^\$db$/;
  function deserializeObject(buffer2, index, options, isArray = false) {
    const fieldsAsRaw = options["fieldsAsRaw"] == null ? null : options["fieldsAsRaw"];
    const raw = options["raw"] == null ? false : options["raw"];
    const bsonRegExp = typeof options["bsonRegExp"] === "boolean" ? options["bsonRegExp"] : false;
    const promoteBuffers = options.promoteBuffers ?? false;
    const promoteLongs = options.promoteLongs ?? true;
    const promoteValues = options.promoteValues ?? true;
    const useBigInt64 = options.useBigInt64 ?? false;
    if (useBigInt64 && !promoteValues) {
      throw new BSONError("Must either request bigint or Long for int64 deserialization");
    }
    if (useBigInt64 && !promoteLongs) {
      throw new BSONError("Must either request bigint or Long for int64 deserialization");
    }
    const validation = options.validation == null ? { utf8: true } : options.validation;
    let globalUTFValidation = true;
    let validationSetting;
    let utf8KeysSet;
    const utf8ValidatedKeys = validation.utf8;
    if (typeof utf8ValidatedKeys === "boolean") {
      validationSetting = utf8ValidatedKeys;
    } else {
      globalUTFValidation = false;
      const utf8ValidationValues = Object.keys(utf8ValidatedKeys).map(function(key) {
        return utf8ValidatedKeys[key];
      });
      if (utf8ValidationValues.length === 0) {
        throw new BSONError("UTF-8 validation setting cannot be empty");
      }
      if (typeof utf8ValidationValues[0] !== "boolean") {
        throw new BSONError("Invalid UTF-8 validation option, must specify boolean values");
      }
      validationSetting = utf8ValidationValues[0];
      if (!utf8ValidationValues.every((item) => item === validationSetting)) {
        throw new BSONError("Invalid UTF-8 validation option - keys must be all true or all false");
      }
    }
    if (!globalUTFValidation) {
      utf8KeysSet = new Set;
      for (const key of Object.keys(utf8ValidatedKeys)) {
        utf8KeysSet.add(key);
      }
    }
    const startIndex = index;
    if (buffer2.length < 5)
      throw new BSONError("corrupt bson message < 5 bytes long");
    const size = NumberUtils.getInt32LE(buffer2, index);
    index += 4;
    if (size < 5 || size > buffer2.length)
      throw new BSONError("corrupt bson message");
    const object = isArray ? [] : {};
    let arrayIndex = 0;
    let isPossibleDBRef = isArray ? false : null;
    while (true) {
      const elementType = buffer2[index++];
      if (elementType === 0)
        break;
      let i = index;
      while (buffer2[i] !== 0 && i < buffer2.length) {
        i++;
      }
      if (i >= buffer2.byteLength)
        throw new BSONError("Bad BSON Document: illegal CString");
      const name = isArray ? arrayIndex++ : ByteUtils.toUTF8(buffer2, index, i, false);
      let shouldValidateKey = true;
      if (globalUTFValidation || utf8KeysSet?.has(name)) {
        shouldValidateKey = validationSetting;
      } else {
        shouldValidateKey = !validationSetting;
      }
      if (isPossibleDBRef !== false && name[0] === "$") {
        isPossibleDBRef = allowedDBRefKeys.test(name);
      }
      let value;
      index = i + 1;
      if (elementType === BSON_DATA_STRING) {
        const stringSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (stringSize <= 0 || stringSize > buffer2.length - index || buffer2[index + stringSize - 1] !== 0) {
          throw new BSONError("bad string length in bson");
        }
        value = ByteUtils.toUTF8(buffer2, index, index + stringSize - 1, shouldValidateKey);
        index = index + stringSize;
      } else if (elementType === BSON_DATA_OID) {
        const oid = ByteUtils.allocateUnsafe(12);
        for (let i2 = 0;i2 < 12; i2++)
          oid[i2] = buffer2[index + i2];
        value = new ObjectId(oid);
        index = index + 12;
      } else if (elementType === BSON_DATA_INT && promoteValues === false) {
        value = new Int32(NumberUtils.getInt32LE(buffer2, index));
        index += 4;
      } else if (elementType === BSON_DATA_INT) {
        value = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
      } else if (elementType === BSON_DATA_NUMBER) {
        value = NumberUtils.getFloat64LE(buffer2, index);
        index += 8;
        if (promoteValues === false)
          value = new Double(value);
      } else if (elementType === BSON_DATA_DATE) {
        const lowBits = NumberUtils.getInt32LE(buffer2, index);
        const highBits = NumberUtils.getInt32LE(buffer2, index + 4);
        index += 8;
        value = new Date(new Long(lowBits, highBits).toNumber());
      } else if (elementType === BSON_DATA_BOOLEAN) {
        if (buffer2[index] !== 0 && buffer2[index] !== 1)
          throw new BSONError("illegal boolean type value");
        value = buffer2[index++] === 1;
      } else if (elementType === BSON_DATA_OBJECT) {
        const _index = index;
        const objectSize = NumberUtils.getInt32LE(buffer2, index);
        if (objectSize <= 0 || objectSize > buffer2.length - index)
          throw new BSONError("bad embedded document length in bson");
        if (raw) {
          value = buffer2.subarray(index, index + objectSize);
        } else {
          let objectOptions = options;
          if (!globalUTFValidation) {
            objectOptions = { ...options, validation: { utf8: shouldValidateKey } };
          }
          value = deserializeObject(buffer2, _index, objectOptions, false);
        }
        index = index + objectSize;
      } else if (elementType === BSON_DATA_ARRAY) {
        const _index = index;
        const objectSize = NumberUtils.getInt32LE(buffer2, index);
        let arrayOptions = options;
        const stopIndex = index + objectSize;
        if (fieldsAsRaw && fieldsAsRaw[name]) {
          arrayOptions = { ...options, raw: true };
        }
        if (!globalUTFValidation) {
          arrayOptions = { ...arrayOptions, validation: { utf8: shouldValidateKey } };
        }
        value = deserializeObject(buffer2, _index, arrayOptions, true);
        index = index + objectSize;
        if (buffer2[index - 1] !== 0)
          throw new BSONError("invalid array terminator byte");
        if (index !== stopIndex)
          throw new BSONError("corrupted array bson");
      } else if (elementType === BSON_DATA_UNDEFINED) {
        value = undefined;
      } else if (elementType === BSON_DATA_NULL) {
        value = null;
      } else if (elementType === BSON_DATA_LONG) {
        if (useBigInt64) {
          value = NumberUtils.getBigInt64LE(buffer2, index);
          index += 8;
        } else {
          const lowBits = NumberUtils.getInt32LE(buffer2, index);
          const highBits = NumberUtils.getInt32LE(buffer2, index + 4);
          index += 8;
          const long = new Long(lowBits, highBits);
          if (promoteLongs && promoteValues === true) {
            value = long.lessThanOrEqual(JS_INT_MAX_LONG) && long.greaterThanOrEqual(JS_INT_MIN_LONG) ? long.toNumber() : long;
          } else {
            value = long;
          }
        }
      } else if (elementType === BSON_DATA_DECIMAL128) {
        const bytes = ByteUtils.allocateUnsafe(16);
        for (let i2 = 0;i2 < 16; i2++)
          bytes[i2] = buffer2[index + i2];
        index = index + 16;
        value = new Decimal128(bytes);
      } else if (elementType === BSON_DATA_BINARY) {
        let binarySize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        const totalBinarySize = binarySize;
        const subType = buffer2[index++];
        if (binarySize < 0)
          throw new BSONError("Negative binary type element size found");
        if (binarySize > buffer2.byteLength)
          throw new BSONError("Binary type size larger than document size");
        if (subType === Binary.SUBTYPE_BYTE_ARRAY) {
          binarySize = NumberUtils.getInt32LE(buffer2, index);
          index += 4;
          if (binarySize < 0)
            throw new BSONError("Negative binary type element size found for subtype 0x02");
          if (binarySize > totalBinarySize - 4)
            throw new BSONError("Binary type with subtype 0x02 contains too long binary size");
          if (binarySize < totalBinarySize - 4)
            throw new BSONError("Binary type with subtype 0x02 contains too short binary size");
        }
        if (promoteBuffers && promoteValues) {
          value = ByteUtils.toLocalBufferType(buffer2.subarray(index, index + binarySize));
        } else {
          value = new Binary(buffer2.subarray(index, index + binarySize), subType);
          if (subType === BSON_BINARY_SUBTYPE_UUID_NEW && UUID.isValid(value)) {
            value = value.toUUID();
          }
        }
        index = index + binarySize;
      } else if (elementType === BSON_DATA_REGEXP && bsonRegExp === false) {
        i = index;
        while (buffer2[i] !== 0 && i < buffer2.length) {
          i++;
        }
        if (i >= buffer2.length)
          throw new BSONError("Bad BSON Document: illegal CString");
        const source = ByteUtils.toUTF8(buffer2, index, i, false);
        index = i + 1;
        i = index;
        while (buffer2[i] !== 0 && i < buffer2.length) {
          i++;
        }
        if (i >= buffer2.length)
          throw new BSONError("Bad BSON Document: illegal CString");
        const regExpOptions = ByteUtils.toUTF8(buffer2, index, i, false);
        index = i + 1;
        const optionsArray = new Array(regExpOptions.length);
        for (i = 0;i < regExpOptions.length; i++) {
          switch (regExpOptions[i]) {
            case "m":
              optionsArray[i] = "m";
              break;
            case "s":
              optionsArray[i] = "g";
              break;
            case "i":
              optionsArray[i] = "i";
              break;
          }
        }
        value = new RegExp(source, optionsArray.join(""));
      } else if (elementType === BSON_DATA_REGEXP && bsonRegExp === true) {
        i = index;
        while (buffer2[i] !== 0 && i < buffer2.length) {
          i++;
        }
        if (i >= buffer2.length)
          throw new BSONError("Bad BSON Document: illegal CString");
        const source = ByteUtils.toUTF8(buffer2, index, i, false);
        index = i + 1;
        i = index;
        while (buffer2[i] !== 0 && i < buffer2.length) {
          i++;
        }
        if (i >= buffer2.length)
          throw new BSONError("Bad BSON Document: illegal CString");
        const regExpOptions = ByteUtils.toUTF8(buffer2, index, i, false);
        index = i + 1;
        value = new BSONRegExp(source, regExpOptions);
      } else if (elementType === BSON_DATA_SYMBOL) {
        const stringSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (stringSize <= 0 || stringSize > buffer2.length - index || buffer2[index + stringSize - 1] !== 0) {
          throw new BSONError("bad string length in bson");
        }
        const symbol = ByteUtils.toUTF8(buffer2, index, index + stringSize - 1, shouldValidateKey);
        value = promoteValues ? symbol : new BSONSymbol(symbol);
        index = index + stringSize;
      } else if (elementType === BSON_DATA_TIMESTAMP) {
        value = new Timestamp({
          i: NumberUtils.getUint32LE(buffer2, index),
          t: NumberUtils.getUint32LE(buffer2, index + 4)
        });
        index += 8;
      } else if (elementType === BSON_DATA_MIN_KEY) {
        value = new MinKey;
      } else if (elementType === BSON_DATA_MAX_KEY) {
        value = new MaxKey;
      } else if (elementType === BSON_DATA_CODE) {
        const stringSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (stringSize <= 0 || stringSize > buffer2.length - index || buffer2[index + stringSize - 1] !== 0) {
          throw new BSONError("bad string length in bson");
        }
        const functionString = ByteUtils.toUTF8(buffer2, index, index + stringSize - 1, shouldValidateKey);
        value = new Code(functionString);
        index = index + stringSize;
      } else if (elementType === BSON_DATA_CODE_W_SCOPE) {
        const totalSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (totalSize < 4 + 4 + 4 + 1) {
          throw new BSONError("code_w_scope total size shorter minimum expected length");
        }
        const stringSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (stringSize <= 0 || stringSize > buffer2.length - index || buffer2[index + stringSize - 1] !== 0) {
          throw new BSONError("bad string length in bson");
        }
        const functionString = ByteUtils.toUTF8(buffer2, index, index + stringSize - 1, shouldValidateKey);
        index = index + stringSize;
        const _index = index;
        const objectSize = NumberUtils.getInt32LE(buffer2, index);
        const scopeObject = deserializeObject(buffer2, _index, options, false);
        index = index + objectSize;
        if (totalSize < 4 + 4 + objectSize + stringSize) {
          throw new BSONError("code_w_scope total size is too short, truncating scope");
        }
        if (totalSize > 4 + 4 + objectSize + stringSize) {
          throw new BSONError("code_w_scope total size is too long, clips outer document");
        }
        value = new Code(functionString, scopeObject);
      } else if (elementType === BSON_DATA_DBPOINTER) {
        const stringSize = NumberUtils.getInt32LE(buffer2, index);
        index += 4;
        if (stringSize <= 0 || stringSize > buffer2.length - index || buffer2[index + stringSize - 1] !== 0)
          throw new BSONError("bad string length in bson");
        const namespace = ByteUtils.toUTF8(buffer2, index, index + stringSize - 1, shouldValidateKey);
        index = index + stringSize;
        const oidBuffer = ByteUtils.allocateUnsafe(12);
        for (let i2 = 0;i2 < 12; i2++)
          oidBuffer[i2] = buffer2[index + i2];
        const oid = new ObjectId(oidBuffer);
        index = index + 12;
        value = new DBRef(namespace, oid);
      } else {
        throw new BSONError(`Detected unknown BSON type ${elementType.toString(16)} for fieldname "${name}"`);
      }
      if (name === "__proto__") {
        Object.defineProperty(object, name, {
          value,
          writable: true,
          enumerable: true,
          configurable: true
        });
      } else {
        object[name] = value;
      }
    }
    if (size !== index - startIndex) {
      if (isArray)
        throw new BSONError("corrupt array bson");
      throw new BSONError("corrupt object bson");
    }
    if (!isPossibleDBRef)
      return object;
    if (isDBRefLike(object)) {
      const copy = Object.assign({}, object);
      delete copy.$ref;
      delete copy.$id;
      delete copy.$db;
      return new DBRef(object.$ref, object.$id, object.$db, copy);
    }
    return object;
  }
  var regexp = /\x00/;
  var ignoreKeys = new Set(["$db", "$ref", "$id", "$clusterTime"]);
  function serializeString(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_STRING;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes + 1;
    buffer2[index - 1] = 0;
    const size = ByteUtils.encodeUTF8Into(buffer2, value, index + 4);
    NumberUtils.setInt32LE(buffer2, index, size + 1);
    index = index + 4 + size;
    buffer2[index++] = 0;
    return index;
  }
  function serializeNumber(buffer2, key, value, index) {
    const isNegativeZero = Object.is(value, -0);
    const type = !isNegativeZero && Number.isSafeInteger(value) && value <= BSON_INT32_MAX && value >= BSON_INT32_MIN ? BSON_DATA_INT : BSON_DATA_NUMBER;
    buffer2[index++] = type;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    if (type === BSON_DATA_INT) {
      index += NumberUtils.setInt32LE(buffer2, index, value);
    } else {
      index += NumberUtils.setFloat64LE(buffer2, index, value);
    }
    return index;
  }
  function serializeBigInt(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_LONG;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index += numberOfWrittenBytes;
    buffer2[index++] = 0;
    index += NumberUtils.setBigInt64LE(buffer2, index, value);
    return index;
  }
  function serializeNull(buffer2, key, _, index) {
    buffer2[index++] = BSON_DATA_NULL;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    return index;
  }
  function serializeBoolean(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_BOOLEAN;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    buffer2[index++] = value ? 1 : 0;
    return index;
  }
  function serializeDate(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_DATE;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const dateInMilis = Long.fromNumber(value.getTime());
    const lowBits = dateInMilis.getLowBits();
    const highBits = dateInMilis.getHighBits();
    index += NumberUtils.setInt32LE(buffer2, index, lowBits);
    index += NumberUtils.setInt32LE(buffer2, index, highBits);
    return index;
  }
  function serializeRegExp(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_REGEXP;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    if (value.source && value.source.match(regexp) != null) {
      throw new BSONError("value " + value.source + " must not contain null bytes");
    }
    index = index + ByteUtils.encodeUTF8Into(buffer2, value.source, index);
    buffer2[index++] = 0;
    if (value.ignoreCase)
      buffer2[index++] = 105;
    if (value.global)
      buffer2[index++] = 115;
    if (value.multiline)
      buffer2[index++] = 109;
    buffer2[index++] = 0;
    return index;
  }
  function serializeBSONRegExp(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_REGEXP;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    if (value.pattern.match(regexp) != null) {
      throw new BSONError("pattern " + value.pattern + " must not contain null bytes");
    }
    index = index + ByteUtils.encodeUTF8Into(buffer2, value.pattern, index);
    buffer2[index++] = 0;
    const sortedOptions = value.options.split("").sort().join("");
    index = index + ByteUtils.encodeUTF8Into(buffer2, sortedOptions, index);
    buffer2[index++] = 0;
    return index;
  }
  function serializeMinMax(buffer2, key, value, index) {
    if (value === null) {
      buffer2[index++] = BSON_DATA_NULL;
    } else if (value._bsontype === "MinKey") {
      buffer2[index++] = BSON_DATA_MIN_KEY;
    } else {
      buffer2[index++] = BSON_DATA_MAX_KEY;
    }
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    return index;
  }
  function serializeObjectId(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_OID;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    index += value.serializeInto(buffer2, index);
    return index;
  }
  function serializeBuffer(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_BINARY;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const size = value.length;
    index += NumberUtils.setInt32LE(buffer2, index, size);
    buffer2[index++] = BSON_BINARY_SUBTYPE_DEFAULT;
    if (size <= 16) {
      for (let i = 0;i < size; i++)
        buffer2[index + i] = value[i];
    } else {
      buffer2.set(value, index);
    }
    index = index + size;
    return index;
  }
  function serializeObject(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path) {
    if (path.has(value)) {
      throw new BSONError("Cannot convert circular structure to BSON");
    }
    path.add(value);
    buffer2[index++] = Array.isArray(value) ? BSON_DATA_ARRAY : BSON_DATA_OBJECT;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const endIndex = serializeInto(buffer2, value, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined, path);
    path.delete(value);
    return endIndex;
  }
  function serializeDecimal128(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_DECIMAL128;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    for (let i = 0;i < 16; i++)
      buffer2[index + i] = value.bytes[i];
    return index + 16;
  }
  function serializeLong(buffer2, key, value, index) {
    buffer2[index++] = value._bsontype === "Long" ? BSON_DATA_LONG : BSON_DATA_TIMESTAMP;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const lowBits = value.getLowBits();
    const highBits = value.getHighBits();
    index += NumberUtils.setInt32LE(buffer2, index, lowBits);
    index += NumberUtils.setInt32LE(buffer2, index, highBits);
    return index;
  }
  function serializeInt32(buffer2, key, value, index) {
    value = value.valueOf();
    buffer2[index++] = BSON_DATA_INT;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    index += NumberUtils.setInt32LE(buffer2, index, value);
    return index;
  }
  function serializeDouble(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_NUMBER;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    index += NumberUtils.setFloat64LE(buffer2, index, value.value);
    return index;
  }
  function serializeFunction(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_CODE;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const functionString = value.toString();
    const size = ByteUtils.encodeUTF8Into(buffer2, functionString, index + 4) + 1;
    NumberUtils.setInt32LE(buffer2, index, size);
    index = index + 4 + size - 1;
    buffer2[index++] = 0;
    return index;
  }
  function serializeCode(buffer2, key, value, index, checkKeys = false, depth = 0, serializeFunctions = false, ignoreUndefined = true, path) {
    if (value.scope && typeof value.scope === "object") {
      buffer2[index++] = BSON_DATA_CODE_W_SCOPE;
      const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
      index = index + numberOfWrittenBytes;
      buffer2[index++] = 0;
      let startIndex = index;
      const functionString = value.code;
      index = index + 4;
      const codeSize = ByteUtils.encodeUTF8Into(buffer2, functionString, index + 4) + 1;
      NumberUtils.setInt32LE(buffer2, index, codeSize);
      buffer2[index + 4 + codeSize - 1] = 0;
      index = index + codeSize + 4;
      const endIndex = serializeInto(buffer2, value.scope, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined, path);
      index = endIndex - 1;
      const totalSize = endIndex - startIndex;
      startIndex += NumberUtils.setInt32LE(buffer2, startIndex, totalSize);
      buffer2[index++] = 0;
    } else {
      buffer2[index++] = BSON_DATA_CODE;
      const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
      index = index + numberOfWrittenBytes;
      buffer2[index++] = 0;
      const functionString = value.code.toString();
      const size = ByteUtils.encodeUTF8Into(buffer2, functionString, index + 4) + 1;
      NumberUtils.setInt32LE(buffer2, index, size);
      index = index + 4 + size - 1;
      buffer2[index++] = 0;
    }
    return index;
  }
  function serializeBinary(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_BINARY;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const data = value.buffer;
    let size = value.position;
    if (value.sub_type === Binary.SUBTYPE_BYTE_ARRAY)
      size = size + 4;
    index += NumberUtils.setInt32LE(buffer2, index, size);
    buffer2[index++] = value.sub_type;
    if (value.sub_type === Binary.SUBTYPE_BYTE_ARRAY) {
      size = size - 4;
      index += NumberUtils.setInt32LE(buffer2, index, size);
    }
    if (value.sub_type === Binary.SUBTYPE_VECTOR) {
      validateBinaryVector(value);
    }
    if (size <= 16) {
      for (let i = 0;i < size; i++)
        buffer2[index + i] = data[i];
    } else {
      buffer2.set(data, index);
    }
    index = index + value.position;
    return index;
  }
  function serializeSymbol(buffer2, key, value, index) {
    buffer2[index++] = BSON_DATA_SYMBOL;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    const size = ByteUtils.encodeUTF8Into(buffer2, value.value, index + 4) + 1;
    NumberUtils.setInt32LE(buffer2, index, size);
    index = index + 4 + size - 1;
    buffer2[index++] = 0;
    return index;
  }
  function serializeDBRef(buffer2, key, value, index, depth, serializeFunctions, path) {
    buffer2[index++] = BSON_DATA_OBJECT;
    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer2, key, index);
    index = index + numberOfWrittenBytes;
    buffer2[index++] = 0;
    let startIndex = index;
    let output = {
      $ref: value.collection || value.namespace,
      $id: value.oid
    };
    if (value.db != null) {
      output.$db = value.db;
    }
    output = Object.assign(output, value.fields);
    const endIndex = serializeInto(buffer2, output, false, index, depth + 1, serializeFunctions, true, path);
    const size = endIndex - startIndex;
    startIndex += NumberUtils.setInt32LE(buffer2, index, size);
    return endIndex;
  }
  function serializeInto(buffer2, object, checkKeys, startingIndex, depth, serializeFunctions, ignoreUndefined, path) {
    if (path == null) {
      if (object == null) {
        buffer2[0] = 5;
        buffer2[1] = 0;
        buffer2[2] = 0;
        buffer2[3] = 0;
        buffer2[4] = 0;
        return 5;
      }
      if (Array.isArray(object)) {
        throw new BSONError("serialize does not support an array as the root input");
      }
      if (typeof object !== "object") {
        throw new BSONError("serialize does not support non-object as the root input");
      } else if ("_bsontype" in object && typeof object._bsontype === "string") {
        throw new BSONError(`BSON types cannot be serialized as a document`);
      } else if (isDate(object) || isRegExp(object) || isUint8Array(object) || isAnyArrayBuffer(object)) {
        throw new BSONError(`date, regexp, typedarray, and arraybuffer cannot be BSON documents`);
      }
      path = new Set;
    }
    path.add(object);
    let index = startingIndex + 4;
    if (Array.isArray(object)) {
      for (let i = 0;i < object.length; i++) {
        const key = `${i}`;
        let value = object[i];
        if (typeof value?.toBSON === "function") {
          value = value.toBSON();
        }
        const type = typeof value;
        if (value === undefined) {
          index = serializeNull(buffer2, key, value, index);
        } else if (value === null) {
          index = serializeNull(buffer2, key, value, index);
        } else if (type === "string") {
          index = serializeString(buffer2, key, value, index);
        } else if (type === "number") {
          index = serializeNumber(buffer2, key, value, index);
        } else if (type === "bigint") {
          index = serializeBigInt(buffer2, key, value, index);
        } else if (type === "boolean") {
          index = serializeBoolean(buffer2, key, value, index);
        } else if (type === "object" && value._bsontype == null) {
          if (value instanceof Date || isDate(value)) {
            index = serializeDate(buffer2, key, value, index);
          } else if (value instanceof Uint8Array || isUint8Array(value)) {
            index = serializeBuffer(buffer2, key, value, index);
          } else if (value instanceof RegExp || isRegExp(value)) {
            index = serializeRegExp(buffer2, key, value, index);
          } else {
            index = serializeObject(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          }
        } else if (type === "object") {
          if (value[BSON_VERSION_SYMBOL] !== BSON_MAJOR_VERSION) {
            throw new BSONVersionError;
          } else if (value._bsontype === "ObjectId") {
            index = serializeObjectId(buffer2, key, value, index);
          } else if (value._bsontype === "Decimal128") {
            index = serializeDecimal128(buffer2, key, value, index);
          } else if (value._bsontype === "Long" || value._bsontype === "Timestamp") {
            index = serializeLong(buffer2, key, value, index);
          } else if (value._bsontype === "Double") {
            index = serializeDouble(buffer2, key, value, index);
          } else if (value._bsontype === "Code") {
            index = serializeCode(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          } else if (value._bsontype === "Binary") {
            index = serializeBinary(buffer2, key, value, index);
          } else if (value._bsontype === "BSONSymbol") {
            index = serializeSymbol(buffer2, key, value, index);
          } else if (value._bsontype === "DBRef") {
            index = serializeDBRef(buffer2, key, value, index, depth, serializeFunctions, path);
          } else if (value._bsontype === "BSONRegExp") {
            index = serializeBSONRegExp(buffer2, key, value, index);
          } else if (value._bsontype === "Int32") {
            index = serializeInt32(buffer2, key, value, index);
          } else if (value._bsontype === "MinKey" || value._bsontype === "MaxKey") {
            index = serializeMinMax(buffer2, key, value, index);
          } else if (typeof value._bsontype !== "undefined") {
            throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);
          }
        } else if (type === "function" && serializeFunctions) {
          index = serializeFunction(buffer2, key, value, index);
        }
      }
    } else if (object instanceof Map || isMap(object)) {
      const iterator = object.entries();
      let done = false;
      while (!done) {
        const entry = iterator.next();
        done = !!entry.done;
        if (done)
          continue;
        const key = entry.value ? entry.value[0] : undefined;
        let value = entry.value ? entry.value[1] : undefined;
        if (typeof value?.toBSON === "function") {
          value = value.toBSON();
        }
        const type = typeof value;
        if (typeof key === "string" && !ignoreKeys.has(key)) {
          if (key.match(regexp) != null) {
            throw new BSONError("key " + key + " must not contain null bytes");
          }
          if (checkKeys) {
            if (key[0] === "$") {
              throw new BSONError("key " + key + " must not start with '$'");
            } else if (key.includes(".")) {
              throw new BSONError("key " + key + " must not contain '.'");
            }
          }
        }
        if (value === undefined) {
          if (ignoreUndefined === false)
            index = serializeNull(buffer2, key, value, index);
        } else if (value === null) {
          index = serializeNull(buffer2, key, value, index);
        } else if (type === "string") {
          index = serializeString(buffer2, key, value, index);
        } else if (type === "number") {
          index = serializeNumber(buffer2, key, value, index);
        } else if (type === "bigint") {
          index = serializeBigInt(buffer2, key, value, index);
        } else if (type === "boolean") {
          index = serializeBoolean(buffer2, key, value, index);
        } else if (type === "object" && value._bsontype == null) {
          if (value instanceof Date || isDate(value)) {
            index = serializeDate(buffer2, key, value, index);
          } else if (value instanceof Uint8Array || isUint8Array(value)) {
            index = serializeBuffer(buffer2, key, value, index);
          } else if (value instanceof RegExp || isRegExp(value)) {
            index = serializeRegExp(buffer2, key, value, index);
          } else {
            index = serializeObject(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          }
        } else if (type === "object") {
          if (value[BSON_VERSION_SYMBOL] !== BSON_MAJOR_VERSION) {
            throw new BSONVersionError;
          } else if (value._bsontype === "ObjectId") {
            index = serializeObjectId(buffer2, key, value, index);
          } else if (value._bsontype === "Decimal128") {
            index = serializeDecimal128(buffer2, key, value, index);
          } else if (value._bsontype === "Long" || value._bsontype === "Timestamp") {
            index = serializeLong(buffer2, key, value, index);
          } else if (value._bsontype === "Double") {
            index = serializeDouble(buffer2, key, value, index);
          } else if (value._bsontype === "Code") {
            index = serializeCode(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          } else if (value._bsontype === "Binary") {
            index = serializeBinary(buffer2, key, value, index);
          } else if (value._bsontype === "BSONSymbol") {
            index = serializeSymbol(buffer2, key, value, index);
          } else if (value._bsontype === "DBRef") {
            index = serializeDBRef(buffer2, key, value, index, depth, serializeFunctions, path);
          } else if (value._bsontype === "BSONRegExp") {
            index = serializeBSONRegExp(buffer2, key, value, index);
          } else if (value._bsontype === "Int32") {
            index = serializeInt32(buffer2, key, value, index);
          } else if (value._bsontype === "MinKey" || value._bsontype === "MaxKey") {
            index = serializeMinMax(buffer2, key, value, index);
          } else if (typeof value._bsontype !== "undefined") {
            throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);
          }
        } else if (type === "function" && serializeFunctions) {
          index = serializeFunction(buffer2, key, value, index);
        }
      }
    } else {
      if (typeof object?.toBSON === "function") {
        object = object.toBSON();
        if (object != null && typeof object !== "object") {
          throw new BSONError("toBSON function did not return an object");
        }
      }
      for (const key of Object.keys(object)) {
        let value = object[key];
        if (typeof value?.toBSON === "function") {
          value = value.toBSON();
        }
        const type = typeof value;
        if (typeof key === "string" && !ignoreKeys.has(key)) {
          if (key.match(regexp) != null) {
            throw new BSONError("key " + key + " must not contain null bytes");
          }
          if (checkKeys) {
            if (key[0] === "$") {
              throw new BSONError("key " + key + " must not start with '$'");
            } else if (key.includes(".")) {
              throw new BSONError("key " + key + " must not contain '.'");
            }
          }
        }
        if (value === undefined) {
          if (ignoreUndefined === false)
            index = serializeNull(buffer2, key, value, index);
        } else if (value === null) {
          index = serializeNull(buffer2, key, value, index);
        } else if (type === "string") {
          index = serializeString(buffer2, key, value, index);
        } else if (type === "number") {
          index = serializeNumber(buffer2, key, value, index);
        } else if (type === "bigint") {
          index = serializeBigInt(buffer2, key, value, index);
        } else if (type === "boolean") {
          index = serializeBoolean(buffer2, key, value, index);
        } else if (type === "object" && value._bsontype == null) {
          if (value instanceof Date || isDate(value)) {
            index = serializeDate(buffer2, key, value, index);
          } else if (value instanceof Uint8Array || isUint8Array(value)) {
            index = serializeBuffer(buffer2, key, value, index);
          } else if (value instanceof RegExp || isRegExp(value)) {
            index = serializeRegExp(buffer2, key, value, index);
          } else {
            index = serializeObject(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          }
        } else if (type === "object") {
          if (value[BSON_VERSION_SYMBOL] !== BSON_MAJOR_VERSION) {
            throw new BSONVersionError;
          } else if (value._bsontype === "ObjectId") {
            index = serializeObjectId(buffer2, key, value, index);
          } else if (value._bsontype === "Decimal128") {
            index = serializeDecimal128(buffer2, key, value, index);
          } else if (value._bsontype === "Long" || value._bsontype === "Timestamp") {
            index = serializeLong(buffer2, key, value, index);
          } else if (value._bsontype === "Double") {
            index = serializeDouble(buffer2, key, value, index);
          } else if (value._bsontype === "Code") {
            index = serializeCode(buffer2, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);
          } else if (value._bsontype === "Binary") {
            index = serializeBinary(buffer2, key, value, index);
          } else if (value._bsontype === "BSONSymbol") {
            index = serializeSymbol(buffer2, key, value, index);
          } else if (value._bsontype === "DBRef") {
            index = serializeDBRef(buffer2, key, value, index, depth, serializeFunctions, path);
          } else if (value._bsontype === "BSONRegExp") {
            index = serializeBSONRegExp(buffer2, key, value, index);
          } else if (value._bsontype === "Int32") {
            index = serializeInt32(buffer2, key, value, index);
          } else if (value._bsontype === "MinKey" || value._bsontype === "MaxKey") {
            index = serializeMinMax(buffer2, key, value, index);
          } else if (typeof value._bsontype !== "undefined") {
            throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);
          }
        } else if (type === "function" && serializeFunctions) {
          index = serializeFunction(buffer2, key, value, index);
        }
      }
    }
    path.delete(object);
    buffer2[index++] = 0;
    const size = index - startingIndex;
    startingIndex += NumberUtils.setInt32LE(buffer2, startingIndex, size);
    return index;
  }
  function isBSONType(value) {
    return value != null && typeof value === "object" && "_bsontype" in value && typeof value._bsontype === "string";
  }
  var keysToCodecs = {
    $oid: ObjectId,
    $binary: Binary,
    $uuid: Binary,
    $symbol: BSONSymbol,
    $numberInt: Int32,
    $numberDecimal: Decimal128,
    $numberDouble: Double,
    $numberLong: Long,
    $minKey: MinKey,
    $maxKey: MaxKey,
    $regex: BSONRegExp,
    $regularExpression: BSONRegExp,
    $timestamp: Timestamp
  };
  function deserializeValue(value, options = {}) {
    if (typeof value === "number") {
      const in32BitRange = value <= BSON_INT32_MAX && value >= BSON_INT32_MIN;
      const in64BitRange = value <= BSON_INT64_MAX && value >= BSON_INT64_MIN;
      if (options.relaxed || options.legacy) {
        return value;
      }
      if (Number.isInteger(value) && !Object.is(value, -0)) {
        if (in32BitRange) {
          return new Int32(value);
        }
        if (in64BitRange) {
          if (options.useBigInt64) {
            return BigInt(value);
          }
          return Long.fromNumber(value);
        }
      }
      return new Double(value);
    }
    if (value == null || typeof value !== "object")
      return value;
    if (value.$undefined)
      return null;
    const keys = Object.keys(value).filter((k) => k.startsWith("$") && value[k] != null);
    for (let i = 0;i < keys.length; i++) {
      const c = keysToCodecs[keys[i]];
      if (c)
        return c.fromExtendedJSON(value, options);
    }
    if (value.$date != null) {
      const d = value.$date;
      const date = new Date;
      if (options.legacy) {
        if (typeof d === "number")
          date.setTime(d);
        else if (typeof d === "string")
          date.setTime(Date.parse(d));
        else if (typeof d === "bigint")
          date.setTime(Number(d));
        else
          throw new BSONRuntimeError(`Unrecognized type for EJSON date: ${typeof d}`);
      } else {
        if (typeof d === "string")
          date.setTime(Date.parse(d));
        else if (Long.isLong(d))
          date.setTime(d.toNumber());
        else if (typeof d === "number" && options.relaxed)
          date.setTime(d);
        else if (typeof d === "bigint")
          date.setTime(Number(d));
        else
          throw new BSONRuntimeError(`Unrecognized type for EJSON date: ${typeof d}`);
      }
      return date;
    }
    if (value.$code != null) {
      const copy = Object.assign({}, value);
      if (value.$scope) {
        copy.$scope = deserializeValue(value.$scope);
      }
      return Code.fromExtendedJSON(value);
    }
    if (isDBRefLike(value) || value.$dbPointer) {
      const v = value.$ref ? value : value.$dbPointer;
      if (v instanceof DBRef)
        return v;
      const dollarKeys = Object.keys(v).filter((k) => k.startsWith("$"));
      let valid = true;
      dollarKeys.forEach((k) => {
        if (["$ref", "$id", "$db"].indexOf(k) === -1)
          valid = false;
      });
      if (valid)
        return DBRef.fromExtendedJSON(v);
    }
    return value;
  }
  function serializeArray(array, options) {
    return array.map((v, index) => {
      options.seenObjects.push({ propertyName: `index ${index}`, obj: null });
      try {
        return serializeValue(v, options);
      } finally {
        options.seenObjects.pop();
      }
    });
  }
  function getISOString(date) {
    const isoStr = date.toISOString();
    return date.getUTCMilliseconds() !== 0 ? isoStr : isoStr.slice(0, -5) + "Z";
  }
  function serializeValue(value, options) {
    if (value instanceof Map || isMap(value)) {
      const obj = Object.create(null);
      for (const [k, v] of value) {
        if (typeof k !== "string") {
          throw new BSONError("Can only serialize maps with string keys");
        }
        obj[k] = v;
      }
      return serializeValue(obj, options);
    }
    if ((typeof value === "object" || typeof value === "function") && value !== null) {
      const index = options.seenObjects.findIndex((entry) => entry.obj === value);
      if (index !== -1) {
        const props = options.seenObjects.map((entry) => entry.propertyName);
        const leadingPart = props.slice(0, index).map((prop) => `${prop} -> `).join("");
        const alreadySeen = props[index];
        const circularPart = " -> " + props.slice(index + 1, props.length - 1).map((prop) => `${prop} -> `).join("");
        const current = props[props.length - 1];
        const leadingSpace = " ".repeat(leadingPart.length + alreadySeen.length / 2);
        const dashes = "-".repeat(circularPart.length + (alreadySeen.length + current.length) / 2 - 1);
        throw new BSONError(`Converting circular structure to EJSON:
` + `    ${leadingPart}${alreadySeen}${circularPart}${current}
` + `    ${leadingSpace}\\${dashes}/`);
      }
      options.seenObjects[options.seenObjects.length - 1].obj = value;
    }
    if (Array.isArray(value))
      return serializeArray(value, options);
    if (value === undefined)
      return null;
    if (value instanceof Date || isDate(value)) {
      const dateNum = value.getTime(), inRange = dateNum > -1 && dateNum < 253402318800000;
      if (options.legacy) {
        return options.relaxed && inRange ? { $date: value.getTime() } : { $date: getISOString(value) };
      }
      return options.relaxed && inRange ? { $date: getISOString(value) } : { $date: { $numberLong: value.getTime().toString() } };
    }
    if (typeof value === "number" && (!options.relaxed || !isFinite(value))) {
      if (Number.isInteger(value) && !Object.is(value, -0)) {
        if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
          return { $numberInt: value.toString() };
        }
        if (value >= BSON_INT64_MIN && value <= BSON_INT64_MAX) {
          return { $numberLong: value.toString() };
        }
      }
      return { $numberDouble: Object.is(value, -0) ? "-0.0" : value.toString() };
    }
    if (typeof value === "bigint") {
      if (!options.relaxed) {
        return { $numberLong: BigInt.asIntN(64, value).toString() };
      }
      return Number(BigInt.asIntN(64, value));
    }
    if (value instanceof RegExp || isRegExp(value)) {
      let flags = value.flags;
      if (flags === undefined) {
        const match = value.toString().match(/[gimuy]*$/);
        if (match) {
          flags = match[0];
        }
      }
      const rx = new BSONRegExp(value.source, flags);
      return rx.toExtendedJSON(options);
    }
    if (value != null && typeof value === "object")
      return serializeDocument(value, options);
    return value;
  }
  var BSON_TYPE_MAPPINGS = {
    Binary: (o) => new Binary(o.value(), o.sub_type),
    Code: (o) => new Code(o.code, o.scope),
    DBRef: (o) => new DBRef(o.collection || o.namespace, o.oid, o.db, o.fields),
    Decimal128: (o) => new Decimal128(o.bytes),
    Double: (o) => new Double(o.value),
    Int32: (o) => new Int32(o.value),
    Long: (o) => Long.fromBits(o.low != null ? o.low : o.low_, o.low != null ? o.high : o.high_, o.low != null ? o.unsigned : o.unsigned_),
    MaxKey: () => new MaxKey,
    MinKey: () => new MinKey,
    ObjectId: (o) => new ObjectId(o),
    BSONRegExp: (o) => new BSONRegExp(o.pattern, o.options),
    BSONSymbol: (o) => new BSONSymbol(o.value),
    Timestamp: (o) => Timestamp.fromBits(o.low, o.high)
  };
  function serializeDocument(doc, options) {
    if (doc == null || typeof doc !== "object")
      throw new BSONError("not an object instance");
    const bsontype = doc._bsontype;
    if (typeof bsontype === "undefined") {
      const _doc = {};
      for (const name of Object.keys(doc)) {
        options.seenObjects.push({ propertyName: name, obj: null });
        try {
          const value = serializeValue(doc[name], options);
          if (name === "__proto__") {
            Object.defineProperty(_doc, name, {
              value,
              writable: true,
              enumerable: true,
              configurable: true
            });
          } else {
            _doc[name] = value;
          }
        } finally {
          options.seenObjects.pop();
        }
      }
      return _doc;
    } else if (doc != null && typeof doc === "object" && typeof doc._bsontype === "string" && doc[BSON_VERSION_SYMBOL] !== BSON_MAJOR_VERSION) {
      throw new BSONVersionError;
    } else if (isBSONType(doc)) {
      let outDoc = doc;
      if (typeof outDoc.toExtendedJSON !== "function") {
        const mapper = BSON_TYPE_MAPPINGS[doc._bsontype];
        if (!mapper) {
          throw new BSONError("Unrecognized or invalid _bsontype: " + doc._bsontype);
        }
        outDoc = mapper(outDoc);
      }
      if (bsontype === "Code" && outDoc.scope) {
        outDoc = new Code(outDoc.code, serializeValue(outDoc.scope, options));
      } else if (bsontype === "DBRef" && outDoc.oid) {
        outDoc = new DBRef(serializeValue(outDoc.collection, options), serializeValue(outDoc.oid, options), serializeValue(outDoc.db, options), serializeValue(outDoc.fields, options));
      }
      return outDoc.toExtendedJSON(options);
    } else {
      throw new BSONError("_bsontype must be a string, but was: " + typeof bsontype);
    }
  }
  function parse(text, options) {
    const ejsonOptions = {
      useBigInt64: options?.useBigInt64 ?? false,
      relaxed: options?.relaxed ?? true,
      legacy: options?.legacy ?? false
    };
    return JSON.parse(text, (key, value) => {
      if (key.indexOf("\x00") !== -1) {
        throw new BSONError(`BSON Document field names cannot contain null bytes, found: ${JSON.stringify(key)}`);
      }
      return deserializeValue(value, ejsonOptions);
    });
  }
  function stringify(value, replacer, space, options) {
    if (space != null && typeof space === "object") {
      options = space;
      space = 0;
    }
    if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
      options = replacer;
      replacer = undefined;
      space = 0;
    }
    const serializeOptions = Object.assign({ relaxed: true, legacy: false }, options, {
      seenObjects: [{ propertyName: "(root)", obj: null }]
    });
    const doc = serializeValue(value, serializeOptions);
    return JSON.stringify(doc, replacer, space);
  }
  function EJSONserialize(value, options) {
    options = options || {};
    return JSON.parse(stringify(value, options));
  }
  function EJSONdeserialize(ejson, options) {
    options = options || {};
    return parse(JSON.stringify(ejson), options);
  }
  var EJSON = Object.create(null);
  EJSON.parse = parse;
  EJSON.stringify = stringify;
  EJSON.serialize = EJSONserialize;
  EJSON.deserialize = EJSONdeserialize;
  Object.freeze(EJSON);
  var BSONElementType = {
    double: 1,
    string: 2,
    object: 3,
    array: 4,
    binData: 5,
    undefined: 6,
    objectId: 7,
    bool: 8,
    date: 9,
    null: 10,
    regex: 11,
    dbPointer: 12,
    javascript: 13,
    symbol: 14,
    javascriptWithScope: 15,
    int: 16,
    timestamp: 17,
    long: 18,
    decimal: 19,
    minKey: 255,
    maxKey: 127
  };
  function getSize(source, offset) {
    try {
      return NumberUtils.getNonnegativeInt32LE(source, offset);
    } catch (cause) {
      throw new BSONOffsetError("BSON size cannot be negative", offset, { cause });
    }
  }
  function findNull(bytes, offset) {
    let nullTerminatorOffset = offset;
    for (;bytes[nullTerminatorOffset] !== 0; nullTerminatorOffset++)
      ;
    if (nullTerminatorOffset === bytes.length - 1) {
      throw new BSONOffsetError("Null terminator not found", offset);
    }
    return nullTerminatorOffset;
  }
  function parseToElements(bytes, startOffset = 0) {
    startOffset ??= 0;
    if (bytes.length < 5) {
      throw new BSONOffsetError(`Input must be at least 5 bytes, got ${bytes.length} bytes`, startOffset);
    }
    const documentSize = getSize(bytes, startOffset);
    if (documentSize > bytes.length - startOffset) {
      throw new BSONOffsetError(`Parsed documentSize (${documentSize} bytes) does not match input length (${bytes.length} bytes)`, startOffset);
    }
    if (bytes[startOffset + documentSize - 1] !== 0) {
      throw new BSONOffsetError("BSON documents must end in 0x00", startOffset + documentSize);
    }
    const elements = [];
    let offset = startOffset + 4;
    while (offset <= documentSize + startOffset) {
      const type = bytes[offset];
      offset += 1;
      if (type === 0) {
        if (offset - startOffset !== documentSize) {
          throw new BSONOffsetError(`Invalid 0x00 type byte`, offset);
        }
        break;
      }
      const nameOffset = offset;
      const nameLength = findNull(bytes, offset) - nameOffset;
      offset += nameLength + 1;
      let length;
      if (type === BSONElementType.double || type === BSONElementType.long || type === BSONElementType.date || type === BSONElementType.timestamp) {
        length = 8;
      } else if (type === BSONElementType.int) {
        length = 4;
      } else if (type === BSONElementType.objectId) {
        length = 12;
      } else if (type === BSONElementType.decimal) {
        length = 16;
      } else if (type === BSONElementType.bool) {
        length = 1;
      } else if (type === BSONElementType.null || type === BSONElementType.undefined || type === BSONElementType.maxKey || type === BSONElementType.minKey) {
        length = 0;
      } else if (type === BSONElementType.regex) {
        length = findNull(bytes, findNull(bytes, offset) + 1) + 1 - offset;
      } else if (type === BSONElementType.object || type === BSONElementType.array || type === BSONElementType.javascriptWithScope) {
        length = getSize(bytes, offset);
      } else if (type === BSONElementType.string || type === BSONElementType.binData || type === BSONElementType.dbPointer || type === BSONElementType.javascript || type === BSONElementType.symbol) {
        length = getSize(bytes, offset) + 4;
        if (type === BSONElementType.binData) {
          length += 1;
        }
        if (type === BSONElementType.dbPointer) {
          length += 12;
        }
      } else {
        throw new BSONOffsetError(`Invalid 0x${type.toString(16).padStart(2, "0")} type byte`, offset);
      }
      if (length > documentSize) {
        throw new BSONOffsetError("value reports length larger than document", offset);
      }
      elements.push([type, nameOffset, nameLength, offset, length]);
      offset += length;
    }
    return elements;
  }
  var onDemand = Object.create(null);
  onDemand.parseToElements = parseToElements;
  onDemand.ByteUtils = ByteUtils;
  onDemand.NumberUtils = NumberUtils;
  Object.freeze(onDemand);
  var MAXSIZE = 1024 * 1024 * 17;
  var buffer = ByteUtils.allocate(MAXSIZE);
  function setInternalBufferSize(size) {
    if (buffer.length < size) {
      buffer = ByteUtils.allocate(size);
    }
  }
  function serialize(object, options = {}) {
    const checkKeys = typeof options.checkKeys === "boolean" ? options.checkKeys : false;
    const serializeFunctions = typeof options.serializeFunctions === "boolean" ? options.serializeFunctions : false;
    const ignoreUndefined = typeof options.ignoreUndefined === "boolean" ? options.ignoreUndefined : true;
    const minInternalBufferSize = typeof options.minInternalBufferSize === "number" ? options.minInternalBufferSize : MAXSIZE;
    if (buffer.length < minInternalBufferSize) {
      buffer = ByteUtils.allocate(minInternalBufferSize);
    }
    const serializationIndex = serializeInto(buffer, object, checkKeys, 0, 0, serializeFunctions, ignoreUndefined, null);
    const finishedBuffer = ByteUtils.allocateUnsafe(serializationIndex);
    finishedBuffer.set(buffer.subarray(0, serializationIndex), 0);
    return finishedBuffer;
  }
  function serializeWithBufferAndIndex(object, finalBuffer, options = {}) {
    const checkKeys = typeof options.checkKeys === "boolean" ? options.checkKeys : false;
    const serializeFunctions = typeof options.serializeFunctions === "boolean" ? options.serializeFunctions : false;
    const ignoreUndefined = typeof options.ignoreUndefined === "boolean" ? options.ignoreUndefined : true;
    const startIndex = typeof options.index === "number" ? options.index : 0;
    const serializationIndex = serializeInto(buffer, object, checkKeys, 0, 0, serializeFunctions, ignoreUndefined, null);
    finalBuffer.set(buffer.subarray(0, serializationIndex), startIndex);
    return startIndex + serializationIndex - 1;
  }
  function deserialize(buffer2, options = {}) {
    return internalDeserialize(ByteUtils.toLocalBufferType(buffer2), options);
  }
  function calculateObjectSize(object, options = {}) {
    options = options || {};
    const serializeFunctions = typeof options.serializeFunctions === "boolean" ? options.serializeFunctions : false;
    const ignoreUndefined = typeof options.ignoreUndefined === "boolean" ? options.ignoreUndefined : true;
    return internalCalculateObjectSize(object, serializeFunctions, ignoreUndefined);
  }
  function deserializeStream(data, startIndex, numberOfDocuments, documents, docStartIndex, options) {
    const internalOptions = Object.assign({ allowObjectSmallerThanBufferSize: true, index: 0 }, options);
    const bufferData = ByteUtils.toLocalBufferType(data);
    let index = startIndex;
    for (let i = 0;i < numberOfDocuments; i++) {
      const size = NumberUtils.getInt32LE(bufferData, index);
      internalOptions.index = index;
      documents[docStartIndex + i] = internalDeserialize(bufferData, internalOptions);
      index = index + size;
    }
    return index;
  }
  var bson = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    BSONError,
    BSONOffsetError,
    BSONRegExp,
    BSONRuntimeError,
    BSONSymbol,
    BSONType,
    BSONValue,
    BSONVersionError,
    Binary,
    Code,
    DBRef,
    Decimal128,
    Double,
    EJSON,
    Int32,
    Long,
    MaxKey,
    MinKey,
    ObjectId,
    Timestamp,
    UUID,
    calculateObjectSize,
    deserialize,
    deserializeStream,
    onDemand,
    serialize,
    serializeWithBufferAndIndex,
    setInternalBufferSize
  });
  exports.BSON = bson;
  exports.BSONError = BSONError;
  exports.BSONOffsetError = BSONOffsetError;
  exports.BSONRegExp = BSONRegExp;
  exports.BSONRuntimeError = BSONRuntimeError;
  exports.BSONSymbol = BSONSymbol;
  exports.BSONType = BSONType;
  exports.BSONValue = BSONValue;
  exports.BSONVersionError = BSONVersionError;
  exports.Binary = Binary;
  exports.Code = Code;
  exports.DBRef = DBRef;
  exports.Decimal128 = Decimal128;
  exports.Double = Double;
  exports.EJSON = EJSON;
  exports.Int32 = Int32;
  exports.Long = Long;
  exports.MaxKey = MaxKey;
  exports.MinKey = MinKey;
  exports.ObjectId = ObjectId;
  exports.Timestamp = Timestamp;
  exports.UUID = UUID;
  exports.calculateObjectSize = calculateObjectSize;
  exports.deserialize = deserialize;
  exports.deserializeStream = deserializeStream;
  exports.onDemand = onDemand;
  exports.serialize = serialize;
  exports.serializeWithBufferAndIndex = serializeWithBufferAndIndex;
  exports.setInternalBufferSize = setInternalBufferSize;
});

// src/types.ts
class Indicator {
  values = [];
  get(index = 0) {
    return this.values[this.values.length - 1 - index];
  }
  getValues() {
    return [...this.values];
  }
  push(value) {
    this.values.push(value);
  }
}
var SimpleMovingAverage, CrossOver, RSI, ATR;
var init_types = __esm(() => {
  SimpleMovingAverage = class SimpleMovingAverage extends Indicator {
    period;
    prices = [];
    constructor(period) {
      super();
      this.period = period;
    }
    update(price) {
      this.prices.push(price);
      if (this.prices.length > this.period) {
        this.prices.shift();
      }
      if (this.prices.length === this.period) {
        const sum = this.prices.reduce((a, b) => a + b, 0);
        this.push(sum / this.period);
      }
    }
  };
  CrossOver = class CrossOver extends Indicator {
    line1;
    line2;
    prevDiff = null;
    constructor(line1, line2) {
      super();
      this.line1 = line1;
      this.line2 = line2;
    }
    update() {
      const val1 = this.line1.get(0);
      const val2 = this.line2.get(0);
      if (val1 === undefined || val2 === undefined) {
        return;
      }
      const diff = val1 - val2;
      if (this.prevDiff !== null) {
        if (this.prevDiff <= 0 && diff > 0) {
          this.push(1);
        } else if (this.prevDiff >= 0 && diff < 0) {
          this.push(-1);
        } else {
          this.push(0);
        }
      }
      this.prevDiff = diff;
    }
  };
  RSI = class RSI extends Indicator {
    period;
    prices = [];
    gains = [];
    losses = [];
    avgGain = 0;
    avgLoss = 0;
    initialized = false;
    constructor(period) {
      super();
      this.period = period;
    }
    update(price) {
      this.prices.push(price);
      if (this.prices.length > this.period) {
        this.prices.shift();
      }
      if (this.prices.length >= 2) {
        const change = this.prices[this.prices.length - 1] - this.prices[this.prices.length - 2];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        this.gains.push(gain);
        this.losses.push(loss);
        if (this.gains.length > this.period) {
          this.gains.shift();
          this.losses.shift();
        }
        if (!this.initialized && this.gains.length === this.period) {
          this.avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
          this.avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;
          this.initialized = true;
        } else if (this.initialized) {
          this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
          this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
        }
        if (this.initialized && this.avgLoss === 0) {
          this.push(100);
        } else if (this.initialized) {
          const rs = this.avgGain / this.avgLoss;
          const rsi = 100 - 100 / (1 + rs);
          this.push(rsi);
        }
      }
    }
  };
  ATR = class ATR extends Indicator {
    period;
    highs = [];
    lows = [];
    closes = [];
    prevClose = null;
    trValues = [];
    constructor(period) {
      super();
      this.period = period;
    }
    update(high, low, close) {
      this.highs.push(high);
      this.lows.push(low);
      this.closes.push(close);
      if (this.highs.length > this.period) {
        this.highs.shift();
        this.lows.shift();
        this.closes.shift();
      }
      if (this.closes.length >= 2) {
        const tr = Math.max(this.highs[this.highs.length - 1] - this.lows[this.lows.length - 1], Math.abs(this.highs[this.highs.length - 1] - this.closes[this.closes.length - 2]), Math.abs(this.lows[this.lows.length - 1] - this.closes[this.closes.length - 2]));
        this.trValues.push(tr);
        if (this.trValues.length > this.period) {
          this.trValues.shift();
        }
        if (this.trValues.length === this.period) {
          const atr = this.trValues.reduce((a, b) => a + b, 0) / this.period;
          this.push(atr);
        }
      }
    }
  };
});

// src/strategies/strat_simple_ma_01.ts
var exports_strat_simple_ma_01 = {};
__export(exports_strat_simple_ma_01, {
  SimpleMAStrategy: () => SimpleMAStrategy
});
import * as fs from "fs";
import * as path from "path";
function loadSavedParams() {
  const paramsPath = path.join(__dirname, "strat_simple_ma_01.params.json");
  if (!fs.existsSync(paramsPath))
    return null;
  try {
    const content = fs.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    const booleanParams = ["trailing_stop", "rsi_enabled", "atr_enabled", "take_profit_enabled"];
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams) {
        if (booleanParams.includes(key)) {
          if (typeof value === "number") {
            params[key] = value === 1;
          } else if (typeof value === "boolean") {
            params[key] = value;
          }
        } else if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class SimpleMAStrategy {
  params;
  fastMA;
  slowMA;
  crossover;
  rsi;
  atr;
  buyPrice = new Map;
  highestPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };
    let fast = mergedParams.fast_period;
    let slow = mergedParams.slow_period;
    if (fast >= slow) {
      [fast, slow] = [slow, fast];
    }
    this.params = {
      fast_period: fast,
      slow_period: slow,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
      rsi_enabled: mergedParams.rsi_enabled,
      rsi_period: mergedParams.rsi_period,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      atr_enabled: mergedParams.atr_enabled,
      atr_multiplier: mergedParams.atr_multiplier,
      take_profit_enabled: mergedParams.take_profit_enabled,
      take_profit: mergedParams.take_profit,
      exit_strategy: mergedParams.exit_strategy
    };
    this.fastMA = new SimpleMovingAverage(this.params.fast_period);
    this.slowMA = new SimpleMovingAverage(this.params.slow_period);
    this.crossover = new CrossOver(this.fastMA, this.slowMA);
    this.rsi = new RSI(this.params.rsi_period);
    this.atr = new ATR(this.params.slow_period);
  }
  onInit(_ctx) {
    console.log(`SimpleMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    console.log(`  RSI: ${this.params.rsi_enabled ? `period=${this.params.rsi_period}, oversold=${this.params.rsi_oversold}, overbought=${this.params.rsi_overbought}` : "disabled"}`);
    console.log(`  ATR: ${this.params.atr_enabled ? `multiplier=${this.params.atr_multiplier}` : "disabled"}`);
    console.log(`  Take Profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : "disabled"}`);
    console.log(`  Exit Strategy: ${this.params.exit_strategy}`);
  }
  onNext(ctx, bar) {
    this.fastMA.update(bar.close);
    this.slowMA.update(bar.close);
    this.crossover.update();
    this.rsi.update(bar.close);
    this.atr.update(bar.high, bar.low, bar.close);
    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = this.crossover.get(0);
    const rsiValue = this.rsi.get(0);
    const atrValue = this.atr.get(0);
    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        let stopPrice;
        if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0) {
          stopPrice = buyPrice - atrValue * this.params.atr_multiplier;
        } else {
          stopPrice = buyPrice * (1 - this.params.stop_loss);
        }
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (this.params.trailing_stop) {
          const currentHighest = highest !== undefined ? Math.max(highest, bar.close) : bar.close;
          this.highestPrice.set(bar.tokenId, currentHighest);
          let trailingStopPrice;
          if (this.params.atr_enabled && atrValue !== undefined) {
            trailingStopPrice = currentHighest - atrValue * this.params.atr_multiplier;
          } else {
            trailingStopPrice = currentHighest * (1 - this.params.stop_loss);
          }
          if (bar.close <= trailingStopPrice && bar.close > buyPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }
        if (this.params.take_profit_enabled) {
          const tpPrice = buyPrice * (1 + this.params.take_profit);
          if (bar.close >= tpPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }
        let shouldSell = false;
        if (this.params.exit_strategy === 0) {
          if (crossoverValue !== undefined && crossoverValue < 0) {
            shouldSell = true;
          }
        } else if (this.params.exit_strategy === 1) {
          if (this.params.rsi_enabled && rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
            shouldSell = true;
          }
        }
        if (shouldSell) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ""}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else {
      let shouldBuy = false;
      if (crossoverValue !== undefined && crossoverValue > 0) {
        if (this.params.rsi_enabled && rsiValue !== undefined) {
          if (rsiValue <= this.params.rsi_oversold) {
            shouldBuy = true;
          }
        } else {
          shouldBuy = true;
        }
      }
      if (shouldBuy) {
        const feeBuffer = 0.995;
        let cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0 && atrValue > 0) {
          const atrRisk = atrValue * this.params.atr_multiplier;
          const maxSizeByATR = ctx.getCapital() * this.params.risk_percent / atrRisk;
          cash = Math.min(cash, maxSizeByATR * bar.close * feeBuffer);
        }
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ""}${atrValue !== undefined ? `, ATR: ${atrValue.toFixed(4)}` : ""}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams;
var init_strat_simple_ma_01 = __esm(() => {
  init_types();
  defaultParams = {
    fast_period: 50,
    slow_period: 200,
    stop_loss: 0.02,
    trailing_stop: false,
    risk_percent: 0.1,
    rsi_enabled: false,
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    atr_enabled: false,
    atr_multiplier: 2,
    take_profit_enabled: false,
    take_profit: 0.05,
    exit_strategy: 0
  };
});

// src/strategies/strat_bollinger_02.ts
var exports_strat_bollinger_02 = {};
__export(exports_strat_bollinger_02, {
  BollingerBandsStrategy: () => BollingerBandsStrategy
});
import * as fs2 from "fs";
import * as path2 from "path";
function loadSavedParams2() {
  const paramsPath = path2.join(__dirname, "strat_bollinger_02.params.json");
  if (!fs2.existsSync(paramsPath))
    return null;
  try {
    const content = fs2.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    const booleanParams = ["trailing_stop", "mean_reversion", "take_profit_enabled", "rsi_enabled", "breakout_enabled"];
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams2) {
        if (booleanParams.includes(key)) {
          if (typeof value === "number") {
            params[key] = value === 1;
          } else if (typeof value === "boolean") {
            params[key] = value;
          }
        } else if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class StandardDeviation {
  prices = [];
  period;
  constructor(period) {
    this.period = period;
  }
  update(price) {
    this.prices.push(price);
    if (this.prices.length > this.period) {
      this.prices.shift();
    }
  }
  get() {
    if (this.prices.length < this.period)
      return;
    const mean = this.prices.reduce((a, b) => a + b, 0) / this.prices.length;
    const squaredDiffs = this.prices.map((p) => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.prices.length;
    return Math.sqrt(variance);
  }
  getValues() {
    return [...this.prices];
  }
}

class BollingerBandsStrategy {
  params;
  indicators = new Map;
  buyPrice = new Map;
  highestPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams2();
    const mergedParams = { ...defaultParams2, ...savedParams, ...params };
    this.params = {
      period: mergedParams.period,
      std_dev_multiplier: mergedParams.std_dev_multiplier,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
      mean_reversion: mergedParams.mean_reversion,
      take_profit: mergedParams.take_profit,
      take_profit_enabled: mergedParams.take_profit_enabled,
      rsi_period: mergedParams.rsi_period,
      rsi_enabled: mergedParams.rsi_enabled,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      breakout_enabled: mergedParams.breakout_enabled,
      breakout_threshold: mergedParams.breakout_threshold
    };
  }
  getIndicators(tokenId) {
    let ind = this.indicators.get(tokenId);
    if (!ind) {
      ind = {
        sma: new SimpleMovingAverage(this.params.period),
        stdDev: new StandardDeviation(this.params.period),
        rsi: new RSI(this.params.rsi_period),
        prices: []
      };
      this.indicators.set(tokenId, ind);
    }
    return ind;
  }
  getBollingerBands(tokenId) {
    const ind = this.getIndicators(tokenId);
    const middle = ind.sma.get(0);
    const stdDev = ind.stdDev.get();
    if (middle === undefined || stdDev === undefined) {
      return { middle: undefined, upper: undefined, lower: undefined };
    }
    return {
      middle,
      upper: middle + this.params.std_dev_multiplier * stdDev,
      lower: middle - this.params.std_dev_multiplier * stdDev
    };
  }
  onInit(_ctx) {
    console.log(`BollingerBandsStrategy initialized with params:`);
    console.log(`  Period: ${this.params.period}`);
    console.log(`  Std Dev Multiplier: ${this.params.std_dev_multiplier}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    console.log(`  Mean reversion mode: ${this.params.mean_reversion}`);
    console.log(`  Take profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : "disabled"}`);
    console.log(`  RSI: ${this.params.rsi_enabled ? `period=${this.params.rsi_period}, oversold=${this.params.rsi_oversold}, overbought=${this.params.rsi_overbought}` : "disabled"}`);
    console.log(`  Breakout: ${this.params.breakout_enabled ? `threshold=${this.params.breakout_threshold * 100}%` : "disabled"}`);
  }
  onNext(ctx, bar) {
    const ind = this.getIndicators(bar.tokenId);
    ind.sma.update(bar.close);
    ind.stdDev.update(bar.close);
    ind.rsi.update(bar.close);
    ind.prices.push(bar.close);
    if (ind.prices.length > this.params.period) {
      ind.prices.shift();
    }
    const position = ctx.getPosition(bar.tokenId);
    const bands = this.getBollingerBands(bar.tokenId);
    const rsiValue = ind.rsi.get(0);
    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (this.params.trailing_stop) {
          const currentHighest = highest !== undefined ? Math.max(highest, bar.close) : bar.close;
          this.highestPrice.set(bar.tokenId, currentHighest);
          const trailingStopPrice = currentHighest * (1 - this.params.stop_loss);
          if (bar.close <= trailingStopPrice && bar.close > buyPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }
        if (this.params.take_profit_enabled && bands.upper !== undefined) {
          const tpPrice = buyPrice * (1 + this.params.take_profit);
          if (bar.close >= tpPrice || bar.close >= bands.upper) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }
        if (bands.upper !== undefined && this.params.mean_reversion) {
          let shouldSell = bar.close >= bands.upper;
          if (this.params.rsi_enabled && rsiValue !== undefined) {
            shouldSell = shouldSell && rsiValue >= this.params.rsi_overbought;
          }
          if (shouldSell) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Bollinger Bands SELL signal (price at upper band) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ""}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      let shouldBuy = false;
      let buyReason = "";
      if (this.params.breakout_enabled && bands.upper !== undefined) {
        const breakoutPrice = bands.upper * (1 + this.params.breakout_threshold);
        if (bar.close >= breakoutPrice) {
          shouldBuy = true;
          buyReason = `breakout above upper band`;
        }
      }
      if (!shouldBuy && this.params.mean_reversion && bands.lower !== undefined && bands.upper !== undefined) {
        if (bar.close <= bands.lower) {
          shouldBuy = true;
          buyReason = `price at lower band`;
        }
      }
      if (shouldBuy && this.params.rsi_enabled && rsiValue !== undefined) {
        shouldBuy = rsiValue <= this.params.rsi_oversold;
        if (shouldBuy) {
          buyReason += `, RSI oversold (${rsiValue.toFixed(2)})`;
        }
      }
      if (shouldBuy) {
        const feeBuffer = 0.995;
        let cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal (${buyReason}) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);
          console.log(`  Bands - Lower: ${bands.lower?.toFixed(4)}, Middle: ${bands.middle?.toFixed(4)}, Upper: ${bands.upper?.toFixed(4)}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams2;
var init_strat_bollinger_02 = __esm(() => {
  init_types();
  defaultParams2 = {
    period: 10,
    std_dev_multiplier: 2,
    stop_loss: 0.03,
    trailing_stop: true,
    risk_percent: 0.15,
    mean_reversion: true,
    take_profit: 0.05,
    take_profit_enabled: false,
    rsi_period: 14,
    rsi_enabled: false,
    rsi_oversold: 30,
    rsi_overbought: 70,
    breakout_enabled: false,
    breakout_threshold: 0.02
  };
});

// src/strategies/strat_rsi_03.ts
var exports_strat_rsi_03 = {};
__export(exports_strat_rsi_03, {
  RSIMeanReversionStrategy: () => RSIMeanReversionStrategy
});
import * as fs3 from "fs";
import * as path3 from "path";
function loadSavedParams3() {
  const paramsPath = path3.join(__dirname, "strat_rsi_03.params.json");
  if (!fs3.existsSync(paramsPath))
    return null;
  try {
    const content = fs3.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams3) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class RSIMeanReversionStrategy {
  params;
  rsiMap = new Map;
  buyPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams3();
    const mergedParams = { ...defaultParams3, ...savedParams, ...params };
    this.params = {
      rsi_period: mergedParams.rsi_period,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent
    };
  }
  getRsi(tokenId) {
    let rsi = this.rsiMap.get(tokenId);
    if (!rsi) {
      rsi = new RSI(this.params.rsi_period);
      this.rsiMap.set(tokenId, rsi);
    }
    return rsi;
  }
  onInit(_ctx) {
    console.log(`RSI Mean Reversion Strategy initialized with params:`);
    console.log(`  RSI period: ${this.params.rsi_period}`);
    console.log(`  Oversold: ${this.params.rsi_oversold}`);
    console.log(`  Overbought: ${this.params.rsi_overbought}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }
  onNext(ctx, bar) {
    const rsi = this.getRsi(bar.tokenId);
    rsi.update(bar.close);
    const position = ctx.getPosition(bar.tokenId);
    const rsiValue = rsi.get(0);
    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }
        if (rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI overbought SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
        }
      }
    } else {
      if (rsiValue !== undefined && rsiValue <= this.params.rsi_oversold) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI oversold BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}, size: ${size.toFixed(2)}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams3;
var init_strat_rsi_03 = __esm(() => {
  init_types();
  defaultParams3 = {
    rsi_period: 5,
    rsi_oversold: 25,
    rsi_overbought: 75,
    stop_loss: 0.05,
    risk_percent: 0.1
  };
});

// src/strategies/strat_atr_breakout_04.ts
var exports_strat_atr_breakout_04 = {};
__export(exports_strat_atr_breakout_04, {
  ATRBreakoutStrategy: () => ATRBreakoutStrategy
});
import * as fs4 from "fs";
import * as path4 from "path";
function loadSavedParams4() {
  const paramsPath = path4.join(__dirname, "strat_atr_breakout_04.params.json");
  if (!fs4.existsSync(paramsPath))
    return null;
  try {
    const content = fs4.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams4) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class ATRBreakoutStrategy {
  params;
  priceHistory = new Map;
  buyPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams4();
    const mergedParams = { ...defaultParams4, ...savedParams, ...params };
    this.params = {
      breakout_multiplier: mergedParams.breakout_multiplier,
      lookback: mergedParams.lookback,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent
    };
  }
  onInit(_ctx) {
    console.log(`ATR Breakout Strategy initialized with params:`);
    console.log(`  Breakout multiplier: ${this.params.breakout_multiplier}`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }
  onNext(ctx, bar) {
    let history = this.priceHistory.get(bar.tokenId);
    if (!history) {
      history = [];
      this.priceHistory.set(bar.tokenId, history);
    }
    history.push(bar.close);
    if (history.length > this.params.lookback) {
      history.shift();
    }
    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }
        if (history.length >= this.params.lookback) {
          const recentHigh = Math.max(...history);
          const recentLow = Math.min(...history);
          const priceRange = recentHigh - recentLow;
          if (priceRange > 0 && bar.close < recentHigh - priceRange * this.params.breakout_multiplier) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      if (history.length >= this.params.lookback) {
        const lookbackPrices = history.slice(0, -1);
        const recentHigh = Math.max(...lookbackPrices);
        const recentLow = Math.min(...lookbackPrices);
        const priceRange = recentHigh - recentLow;
        if (priceRange > 0) {
          const breakoutLevel = recentHigh + priceRange * this.params.breakout_multiplier;
          if (bar.close > breakoutLevel) {
            const feeBuffer = 0.995;
            const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
            const size = cash / bar.close;
            if (size > 0 && cash <= ctx.getCapital()) {
              console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Breakout BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, breakout: ${breakoutLevel.toFixed(4)}, range: ${priceRange.toFixed(4)}, size: ${size.toFixed(2)}`);
              const result = ctx.buy(bar.tokenId, size);
              if (result.success) {
                this.buyPrice.set(bar.tokenId, bar.close);
              } else {
                console.error(`  Order failed: ${result.error}`);
              }
            }
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams4;
var init_strat_atr_breakout_04 = __esm(() => {
  defaultParams4 = {
    breakout_multiplier: 0.5,
    lookback: 10,
    stop_loss: 0.05,
    risk_percent: 0.1
  };
});

// src/strategies/strat_ma_atr_05.ts
var exports_strat_ma_atr_05 = {};
__export(exports_strat_ma_atr_05, {
  MAStrategyWithATRStop: () => MAStrategyWithATRStop
});
import * as fs5 from "fs";
import * as path5 from "path";
function loadSavedParams5() {
  const paramsPath = path5.join(__dirname, "strat_ma_atr_05.params.json");
  if (!fs5.existsSync(paramsPath))
    return null;
  try {
    const content = fs5.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams5) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}
function stddev(values) {
  if (values.length < 2)
    return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
  return Math.sqrt(sqDiffs / values.length);
}

class MAStrategyWithATRStop {
  params;
  fastMAs = new Map;
  slowMAs = new Map;
  crossovers = new Map;
  priceBuffers = new Map;
  buyPrice = new Map;
  buyVolatility = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams5();
    const mergedParams = { ...defaultParams5, ...savedParams, ...params };
    this.params = {
      fast_period: mergedParams.fast_period,
      slow_period: mergedParams.slow_period,
      volatility_period: mergedParams.volatility_period,
      vol_multiplier: mergedParams.vol_multiplier,
      risk_percent: mergedParams.risk_percent
    };
  }
  getIndicators(tokenId) {
    let fastMA = this.fastMAs.get(tokenId);
    let slowMA = this.slowMAs.get(tokenId);
    let crossover = this.crossovers.get(tokenId);
    if (!fastMA || !slowMA || !crossover) {
      fastMA = new SimpleMovingAverage(this.params.fast_period);
      slowMA = new SimpleMovingAverage(this.params.slow_period);
      crossover = new CrossOver(fastMA, slowMA);
      this.fastMAs.set(tokenId, fastMA);
      this.slowMAs.set(tokenId, slowMA);
      this.crossovers.set(tokenId, crossover);
    }
    return { fastMA, slowMA, crossover };
  }
  updatePriceBuffer(tokenId, price) {
    let buffer = this.priceBuffers.get(tokenId);
    if (!buffer) {
      buffer = [];
      this.priceBuffers.set(tokenId, buffer);
    }
    buffer.push(price);
    if (buffer.length > this.params.volatility_period) {
      buffer.shift();
    }
    return buffer;
  }
  onInit(_ctx) {
    console.log(`MA + Volatility Stop Strategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Volatility period: ${this.params.volatility_period}`);
    console.log(`  Volatility multiplier: ${this.params.vol_multiplier}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }
  onNext(ctx, bar) {
    const { fastMA, slowMA, crossover } = this.getIndicators(bar.tokenId);
    fastMA.update(bar.close);
    slowMA.update(bar.close);
    crossover.update();
    const priceBuffer = this.updatePriceBuffer(bar.tokenId, bar.close);
    const currentVol = stddev(priceBuffer);
    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = crossover.get(0);
    if (position && position.size > 0) {
      const entryPrice = this.buyPrice.get(bar.tokenId);
      const entryVol = this.buyVolatility.get(bar.tokenId);
      if (entryPrice !== undefined && entryVol !== undefined) {
        const effectiveVol = Math.max(entryVol, currentVol);
        const stopDistance = effectiveVol > 0.000000001 ? effectiveVol * this.params.vol_multiplier : entryPrice * 0.02;
        const stopPrice = entryPrice - stopDistance;
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Volatility stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)} (stop: ${stopPrice.toFixed(4)})`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyVolatility.delete(bar.tokenId);
          return;
        }
        if (crossoverValue !== undefined && crossoverValue < 0) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyVolatility.delete(bar.tokenId);
        }
      }
    } else {
      if (crossoverValue !== undefined && crossoverValue > 0) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.buyVolatility.set(bar.tokenId, currentVol);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams5;
var init_strat_ma_atr_05 = __esm(() => {
  init_types();
  defaultParams5 = {
    fast_period: 5,
    slow_period: 15,
    volatility_period: 20,
    vol_multiplier: 2,
    risk_percent: 0.1
  };
});

// src/strategies/strat_support_06.ts
var exports_strat_support_06 = {};
__export(exports_strat_support_06, {
  SupportResistanceStrategy: () => SupportResistanceStrategy
});
import * as fs6 from "fs";
import * as path6 from "path";
function loadSavedParams6() {
  const paramsPath = path6.join(__dirname, "strat_support_06.params.json");
  if (!fs6.existsSync(paramsPath))
    return null;
  try {
    const content = fs6.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams6) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class SupportResistanceStrategy {
  params;
  lows = new Map;
  highs = new Map;
  prevClose = new Map;
  buyPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams6();
    const mergedParams = { ...defaultParams6, ...savedParams, ...params };
    this.params = {
      lookback: mergedParams.lookback,
      bounce_threshold: mergedParams.bounce_threshold,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
      take_profit: mergedParams.take_profit
    };
  }
  onInit(_ctx) {
    console.log(`Support/Resistance Strategy initialized with params:`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Bounce threshold: ${this.params.bounce_threshold * 100}%`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Take profit: ${this.params.take_profit * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }
  onNext(ctx, bar) {
    let tokenLows = this.lows.get(bar.tokenId) || [];
    let tokenHighs = this.highs.get(bar.tokenId) || [];
    tokenLows.push(bar.low);
    tokenHighs.push(bar.high);
    if (tokenLows.length > this.params.lookback) {
      tokenLows.shift();
      tokenHighs.shift();
    }
    this.lows.set(bar.tokenId, tokenLows);
    this.highs.set(bar.tokenId, tokenHighs);
    const position = ctx.getPosition(bar.tokenId);
    const prev = this.prevClose.get(bar.tokenId);
    this.prevClose.set(bar.tokenId, bar.close);
    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }
        const targetPrice = buyPrice * (1 + this.params.take_profit);
        if (bar.close >= targetPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }
        if (tokenHighs.length >= this.params.lookback) {
          const resistance = Math.max(...tokenHighs);
          if (bar.close >= resistance * (1 - this.params.bounce_threshold)) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Resistance SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      if (bar.close > 0.8 || bar.close < 0.05) {
        return;
      }
      if (tokenLows.length >= this.params.lookback && prev !== undefined) {
        const support = Math.min(...tokenLows);
        const bounceLevel = support * (1 + this.params.bounce_threshold);
        if (bar.close <= bounceLevel && bar.close > prev) {
          const feeBuffer = 0.995;
          const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Support bounce BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, support: ${support.toFixed(4)}, size: ${size.toFixed(2)}`);
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.buyPrice.set(bar.tokenId, bar.close);
            } else {
              console.error(`  Order failed: ${result.error}`);
            }
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams6;
var init_strat_support_06 = __esm(() => {
  defaultParams6 = {
    lookback: 10,
    bounce_threshold: 0.05,
    stop_loss: 0.05,
    risk_percent: 0.1,
    take_profit: 0.1
  };
});

// src/strategies/strat_momentum_07.ts
var exports_strat_momentum_07 = {};
__export(exports_strat_momentum_07, {
  ShortTermStrategy: () => ShortTermStrategy
});
import * as fs7 from "fs";
import * as path7 from "path";
function loadSavedParams7() {
  const paramsPath = path7.join(__dirname, "strat_momentum_07.params.json");
  if (!fs7.existsSync(paramsPath))
    return null;
  try {
    const content = fs7.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams7) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class ShortTermStrategy {
  params;
  priceHistory = new Map;
  entryPrice = new Map;
  highestSinceEntry = new Map;
  barsHeld = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams7();
    const mergedParams = { ...defaultParams7, ...savedParams, ...params };
    this.params = {
      lookback: Math.max(2, Math.floor(mergedParams.lookback)),
      entry_threshold: mergedParams.entry_threshold,
      trailing_stop_pct: mergedParams.trailing_stop_pct,
      minimum_hold: Math.max(0, Math.floor(mergedParams.minimum_hold)),
      risk_percent: mergedParams.risk_percent
    };
  }
  onInit(_ctx) {
    console.log(`ShortTermStrategy initialized:`);
    console.log(`  Lookback: ${this.params.lookback} bars`);
    console.log(`  Entry threshold: ${(this.params.entry_threshold * 100).toFixed(1)}%`);
    console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
    console.log(`  Minimum hold: ${this.params.minimum_hold} bars`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }
  getPriceChange(tokenId) {
    const history = this.priceHistory.get(tokenId);
    if (!history || history.length < this.params.lookback + 1) {
      return;
    }
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.lookback];
    if (past <= 0)
      return;
    return (current - past) / past;
  }
  onNext(ctx, bar) {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId);
    history.push(bar.close);
    const maxHistory = this.params.lookback + 5;
    if (history.length > maxHistory) {
      history.shift();
    }
    const priceChange = this.getPriceChange(bar.tokenId);
    if (priceChange === undefined) {
      return;
    }
    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        const prevHighest = this.highestSinceEntry.get(bar.tokenId) ?? entry;
        const highest = Math.max(prevHighest, bar.close);
        this.highestSinceEntry.set(bar.tokenId, highest);
        const held = (this.barsHeld.get(bar.tokenId) ?? 0) + 1;
        this.barsHeld.set(bar.tokenId, held);
        if (held >= this.params.minimum_hold) {
          const drawdownFromHighest = (highest - bar.close) / highest;
          if (drawdownFromHighest >= this.params.trailing_stop_pct) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdownFromHighest * 100).toFixed(1)}%`);
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.highestSinceEntry.delete(bar.tokenId);
            this.barsHeld.delete(bar.tokenId);
            return;
          }
        }
      }
    } else {
      if (priceChange >= this.params.entry_threshold) {
        if (bar.close > 0.1 && bar.close < 0.9) {
          const cash = ctx.getCapital() * this.params.risk_percent;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... change=${(priceChange * 100).toFixed(1)}% price=${bar.close.toFixed(4)}`);
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.highestSinceEntry.set(bar.tokenId, bar.close);
              this.barsHeld.set(bar.tokenId, 0);
            }
          }
        }
      }
    }
  }
  onComplete(_ctx) {
    console.log(`
Strategy completed.`);
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams7;
var init_strat_momentum_07 = __esm(() => {
  defaultParams7 = {
    lookback: 3,
    entry_threshold: 0.05,
    trailing_stop_pct: 0.05,
    minimum_hold: 3,
    risk_percent: 0.1
  };
});

// src/strategies/strat_range_08.ts
var exports_strat_range_08 = {};
__export(exports_strat_range_08, {
  RangeTradingStrategy: () => RangeTradingStrategy
});
import * as fs8 from "fs";
import * as path8 from "path";
function loadSavedParams8() {
  const paramsPath = path8.join(__dirname, "strat_range_08.params.json");
  if (!fs8.existsSync(paramsPath))
    return null;
  try {
    const content = fs8.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams8) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class RangeTradingStrategy {
  params;
  entryPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams8();
    const mergedParams = { ...defaultParams8, ...savedParams, ...params };
    let buyBelow = mergedParams.buy_below;
    let sellAbove = mergedParams.sell_above;
    if (buyBelow >= sellAbove) {
      [buyBelow, sellAbove] = [sellAbove, buyBelow];
    }
    this.params = {
      buy_below: buyBelow,
      sell_above: sellAbove,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent
    };
  }
  onInit(_ctx) {
    console.log(`RangeTradingStrategy initialized:`);
    console.log(`  Buy below: ${(this.params.buy_below * 100).toFixed(0)}%`);
    console.log(`  Sell above: ${(this.params.sell_above * 100).toFixed(0)}%`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }
  onNext(ctx, bar) {
    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= this.params.sell_above) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TAKE PROFIT ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
      }
    } else {
      if (bar.close <= this.params.buy_below && bar.close > 0.02) {
        const cash = ctx.getCapital() * this.params.risk_percent;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }
  onComplete(_ctx) {
    console.log(`
Strategy completed.`);
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams8;
var init_strat_range_08 = __esm(() => {
  defaultParams8 = {
    buy_below: 0.3,
    sell_above: 0.6,
    stop_loss: 0.15,
    risk_percent: 0.1
  };
});

// src/strategies/strat_mean_revert_09.ts
var exports_strat_mean_revert_09 = {};
__export(exports_strat_mean_revert_09, {
  MeanReversionStrategy: () => MeanReversionStrategy
});
import * as fs9 from "fs";
import * as path9 from "path";
function loadSavedParams9() {
  const paramsPath = path9.join(__dirname, "strat_mean_revert_09.params.json");
  if (!fs9.existsSync(paramsPath))
    return null;
  try {
    const content = fs9.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams9) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class MeanReversionStrategy {
  params;
  smaMap = new Map;
  entryPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams9();
    const mergedParams = { ...defaultParams9, ...savedParams, ...params };
    this.params = {
      ma_period: Math.max(2, Math.floor(mergedParams.ma_period)),
      deviation_threshold: mergedParams.deviation_threshold,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent
    };
  }
  onInit(_ctx) {
    console.log(`MeanReversionStrategy initialized:`);
    console.log(`  MA period: ${this.params.ma_period}`);
    console.log(`  Deviation threshold: ${(this.params.deviation_threshold * 100).toFixed(1)}%`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }
  getSMA(tokenId) {
    let sma = this.smaMap.get(tokenId);
    if (!sma) {
      sma = new SimpleMovingAverage(this.params.ma_period);
      this.smaMap.set(tokenId, sma);
    }
    return sma;
  }
  onNext(ctx, bar) {
    const sma = this.getSMA(bar.tokenId);
    sma.update(bar.close);
    const maValue = sma.get(0);
    if (maValue === undefined) {
      return;
    }
    const price = bar.close;
    const deviation = maValue - price;
    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (price < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (price >= maValue) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MEAN REVERT EXIT ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
      }
    } else {
      if (deviation >= this.params.deviation_threshold) {
        if (price >= 0.05 && price <= 0.9) {
          const cash = ctx.getCapital() * this.params.risk_percent;
          const size = cash / price;
          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)} dev=${(deviation * 100).toFixed(1)}%`);
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, price);
            }
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams9;
var init_strat_mean_revert_09 = __esm(() => {
  init_types();
  defaultParams9 = {
    ma_period: 8,
    deviation_threshold: 0.03,
    stop_loss: 0.08,
    risk_percent: 0.1
  };
});

// src/strategies/strat_dual_ma_10.ts
var exports_strat_dual_ma_10 = {};
__export(exports_strat_dual_ma_10, {
  DualMAStrategy: () => DualMAStrategy
});
import * as fs10 from "fs";
import * as path10 from "path";
function loadSavedParams10() {
  const paramsPath = path10.join(__dirname, "strat_dual_ma_10.params.json");
  if (!fs10.existsSync(paramsPath))
    return null;
  try {
    const content = fs10.readFileSync(paramsPath, "utf-8");
    const saved = JSON.parse(content);
    const params = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== "metadata" && key in defaultParams10) {
        if (typeof value === "number") {
          params[key] = value;
        }
      }
    }
    return params;
  } catch {
    return null;
  }
}

class DualMAStrategy {
  params;
  fastMAs = new Map;
  slowMAs = new Map;
  trendMAs = new Map;
  crossovers = new Map;
  buyPrice = new Map;
  highestPrice = new Map;
  constructor(params = {}) {
    const savedParams = loadSavedParams10();
    const mergedParams = { ...defaultParams10, ...savedParams, ...params };
    let fast = mergedParams.fast_period;
    let slow = mergedParams.slow_period;
    let trend = mergedParams.trend_period;
    const sorted = [fast, slow, trend].sort((a, b) => a - b);
    fast = sorted[0];
    slow = sorted[1];
    trend = sorted[2];
    this.params = {
      fast_period: fast,
      slow_period: slow,
      trend_period: trend,
      stop_loss: mergedParams.stop_loss,
      trailing_stop_pct: mergedParams.trailing_stop_pct,
      risk_percent: mergedParams.risk_percent
    };
  }
  getIndicators(tokenId) {
    if (!this.fastMAs.has(tokenId)) {
      const fastMA = new SimpleMovingAverage(this.params.fast_period);
      const slowMA = new SimpleMovingAverage(this.params.slow_period);
      const trendMA = new SimpleMovingAverage(this.params.trend_period);
      const crossover = new CrossOver(fastMA, slowMA);
      this.fastMAs.set(tokenId, fastMA);
      this.slowMAs.set(tokenId, slowMA);
      this.trendMAs.set(tokenId, trendMA);
      this.crossovers.set(tokenId, crossover);
    }
    return {
      fastMA: this.fastMAs.get(tokenId),
      slowMA: this.slowMAs.get(tokenId),
      trendMA: this.trendMAs.get(tokenId),
      crossover: this.crossovers.get(tokenId)
    };
  }
  onInit(_ctx) {
    console.log(`DualMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Trend MA period: ${this.params.trend_period}`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }
  onNext(ctx, bar) {
    const { fastMA, slowMA, trendMA, crossover } = this.getIndicators(bar.tokenId);
    fastMA.update(bar.close);
    slowMA.update(bar.close);
    trendMA.update(bar.close);
    crossover.update();
    const crossoverValue = crossover.get(0);
    const trendValue = trendMA.get(0);
    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.buyPrice.get(bar.tokenId);
      if (entry !== undefined) {
        const stopPrice = entry * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} entry=${entry.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const prevHighest = this.highestPrice.get(bar.tokenId) ?? entry;
        const highest = Math.max(prevHighest, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        const drawdown = (highest - bar.close) / highest;
        if (drawdown >= this.params.trailing_stop_pct && bar.close > entry) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdown * 100).toFixed(1)}%`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (crossoverValue !== undefined && crossoverValue < 0) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL crossover ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
      }
      return;
    }
    if (bar.close < 0.05 || bar.close > 0.95) {
      return;
    }
    if (crossoverValue !== undefined && crossoverValue > 0) {
      if (trendValue !== undefined && bar.close > trendValue) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} trendMA=${trendValue.toFixed(4)}`);
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }
  onComplete(ctx) {
    console.log(`
Strategy completed.`);
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
var __dirname = "/Users/heinrich/Documents/testbtc/src/strategies", defaultParams10;
var init_strat_dual_ma_10 = __esm(() => {
  init_types();
  defaultParams10 = {
    fast_period: 5,
    slow_period: 12,
    trend_period: 25,
    stop_loss: 0.05,
    trailing_stop_pct: 0.03,
    risk_percent: 0.1
  };
});

// node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

// node_modules/kleur/index.mjs
var FORCE_COLOR;
var NODE_DISABLE_COLORS;
var NO_COLOR;
var TERM;
var isTTY = true;
if (typeof process !== "undefined") {
  ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {});
  isTTY = process.stdout && process.stdout.isTTY;
}
var $ = {
  enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY),
  reset: init(0, 0),
  bold: init(1, 22),
  dim: init(2, 22),
  italic: init(3, 23),
  underline: init(4, 24),
  inverse: init(7, 27),
  hidden: init(8, 28),
  strikethrough: init(9, 29),
  black: init(30, 39),
  red: init(31, 39),
  green: init(32, 39),
  yellow: init(33, 39),
  blue: init(34, 39),
  magenta: init(35, 39),
  cyan: init(36, 39),
  white: init(37, 39),
  gray: init(90, 39),
  grey: init(90, 39),
  bgBlack: init(40, 49),
  bgRed: init(41, 49),
  bgGreen: init(42, 49),
  bgYellow: init(43, 49),
  bgBlue: init(44, 49),
  bgMagenta: init(45, 49),
  bgCyan: init(46, 49),
  bgWhite: init(47, 49)
};
function run(arr, str) {
  let i = 0, tmp, beg = "", end = "";
  for (;i < arr.length; i++) {
    tmp = arr[i];
    beg += tmp.open;
    end += tmp.close;
    if (!!~str.indexOf(tmp.close)) {
      str = str.replace(tmp.rgx, tmp.close + tmp.open);
    }
  }
  return beg + str + end;
}
function chain(has, keys) {
  let ctx = { has, keys };
  ctx.reset = $.reset.bind(ctx);
  ctx.bold = $.bold.bind(ctx);
  ctx.dim = $.dim.bind(ctx);
  ctx.italic = $.italic.bind(ctx);
  ctx.underline = $.underline.bind(ctx);
  ctx.inverse = $.inverse.bind(ctx);
  ctx.hidden = $.hidden.bind(ctx);
  ctx.strikethrough = $.strikethrough.bind(ctx);
  ctx.black = $.black.bind(ctx);
  ctx.red = $.red.bind(ctx);
  ctx.green = $.green.bind(ctx);
  ctx.yellow = $.yellow.bind(ctx);
  ctx.blue = $.blue.bind(ctx);
  ctx.magenta = $.magenta.bind(ctx);
  ctx.cyan = $.cyan.bind(ctx);
  ctx.white = $.white.bind(ctx);
  ctx.gray = $.gray.bind(ctx);
  ctx.grey = $.grey.bind(ctx);
  ctx.bgBlack = $.bgBlack.bind(ctx);
  ctx.bgRed = $.bgRed.bind(ctx);
  ctx.bgGreen = $.bgGreen.bind(ctx);
  ctx.bgYellow = $.bgYellow.bind(ctx);
  ctx.bgBlue = $.bgBlue.bind(ctx);
  ctx.bgMagenta = $.bgMagenta.bind(ctx);
  ctx.bgCyan = $.bgCyan.bind(ctx);
  ctx.bgWhite = $.bgWhite.bind(ctx);
  return ctx;
}
function init(open, close) {
  let blk = {
    open: `\x1B[${open}m`,
    close: `\x1B[${close}m`,
    rgx: new RegExp(`\\x1b\\[${close}m`, "g")
  };
  return function(txt) {
    if (this !== undefined && this.has !== undefined) {
      !!~this.has.indexOf(open) || (this.has.push(open), this.keys.push(blk));
      return txt === undefined ? this : $.enabled ? run(this.keys, txt + "") : txt + "";
    }
    return txt === undefined ? chain([open], [blk]) : $.enabled ? run([blk], txt + "") : txt + "";
  };
}
var kleur_default = $;

// src/backtest/portfolio.ts
class Portfolio {
  capital;
  initialCapital;
  positions = new Map;
  tradeHistory = [];
  feeRate;
  constructor(initialCapital, feeRate = 0) {
    this.capital = initialCapital;
    this.initialCapital = initialCapital;
    this.feeRate = feeRate;
  }
  buy(tokenId, size, price, timestamp) {
    const totalCost = size * price;
    const fee = totalCost * this.feeRate;
    const totalWithFee = totalCost + fee;
    if (totalWithFee > this.capital + 0.001) {
      return {
        success: false,
        tokenId,
        side: "BUY",
        size: 0,
        price,
        totalCost: 0,
        error: `Insufficient capital: need ${totalWithFee.toFixed(2)}, have ${this.capital.toFixed(2)}`
      };
    }
    this.capital -= totalWithFee;
    const existing = this.positions.get(tokenId);
    if (existing) {
      const newSize = existing.size + size;
      const newAvgPrice = (existing.avgPrice * existing.size + price * size) / newSize;
      existing.size = newSize;
      existing.avgPrice = newAvgPrice;
      if (!existing.buyPrice) {
        existing.buyPrice = price;
      }
    } else {
      this.positions.set(tokenId, {
        tokenId,
        size,
        avgPrice: price,
        currentValue: size * price,
        pnl: 0,
        buyPrice: price
      });
    }
    const record = {
      timestamp,
      tokenId,
      side: "BUY",
      size,
      price,
      totalCost: totalWithFee,
      positionSizeAfter: this.positions.get(tokenId)?.size ?? 0,
      capitalAfter: this.capital
    };
    this.tradeHistory.push(record);
    return {
      success: true,
      tokenId,
      side: "BUY",
      size,
      price,
      totalCost: totalWithFee
    };
  }
  sell(tokenId, size, price, timestamp) {
    const position = this.positions.get(tokenId);
    if (!position || position.size < size) {
      return {
        success: false,
        tokenId,
        side: "SELL",
        size: 0,
        price,
        totalCost: 0,
        error: `Insufficient position: trying to sell ${size}, have ${position?.size ?? 0}`
      };
    }
    const totalValue = size * price;
    const fee = totalValue * this.feeRate;
    const totalAfterFee = totalValue - fee;
    this.capital += totalAfterFee;
    position.size -= size;
    if (position.size === 0) {
      this.positions.delete(tokenId);
    } else {
      position.currentValue = position.size * price;
    }
    const record = {
      timestamp,
      tokenId,
      side: "SELL",
      size,
      price,
      totalCost: totalAfterFee,
      positionSizeAfter: position.size,
      capitalAfter: this.capital
    };
    this.tradeHistory.push(record);
    return {
      success: true,
      tokenId,
      side: "SELL",
      size,
      price,
      totalCost: totalAfterFee
    };
  }
  close(tokenId, price, timestamp) {
    const position = this.positions.get(tokenId);
    if (!position) {
      return {
        success: false,
        tokenId,
        side: "SELL",
        size: 0,
        price,
        totalCost: 0,
        error: "No position to close"
      };
    }
    return this.sell(tokenId, position.size, price, timestamp);
  }
  updatePositionValues(prices) {
    for (const [tokenId, position] of this.positions) {
      const price = prices.get(tokenId);
      if (price !== undefined) {
        position.currentValue = position.size * price;
        position.pnl = position.currentValue - position.size * position.avgPrice;
      }
    }
  }
  getPosition(tokenId) {
    return this.positions.get(tokenId);
  }
  getAllPositions() {
    return Array.from(this.positions.values());
  }
  getCapital() {
    return this.capital;
  }
  getTotalValue(prices) {
    let total = this.capital;
    for (const [tokenId, position] of this.positions) {
      const price = prices.get(tokenId);
      if (price !== undefined) {
        total += position.size * price;
      }
    }
    return total;
  }
  getPnL(prices) {
    return this.getTotalValue(prices) - this.initialCapital;
  }
  getTradeHistory() {
    return [...this.tradeHistory];
  }
  getInitialCapital() {
    return this.initialCapital;
  }
}

// src/backtest/engine.ts
class BacktestEngine {
  config;
  data;
  portfolio;
  strategy;
  bars = new Map;
  currentBarIndex = 0;
  maxBars = 0;
  currentBar = null;
  barHistory = new Map;
  constructor(data, strategy, config) {
    this.data = data;
    this.strategy = strategy;
    this.config = {
      initialCapital: config?.initialCapital ?? 1000,
      feeRate: config?.feeRate ?? 0,
      slippage: config?.slippage ?? 0
    };
    this.portfolio = new Portfolio(this.config.initialCapital, this.config.feeRate);
    this.prepareBars();
  }
  prepareBars() {
    const allTimestamps = new Set;
    for (const [tokenId, history] of this.data.priceHistory) {
      for (const point of history) {
        allTimestamps.add(point.t);
      }
    }
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    for (const [tokenId, history] of this.data.priceHistory) {
      const priceMap = new Map;
      for (const point of history) {
        priceMap.set(point.t, point.p);
      }
      const market = this.findMarketForToken(tokenId);
      if (!market)
        continue;
      const tokenBars = [];
      for (const ts of sortedTimestamps) {
        const price = priceMap.get(ts);
        if (price !== undefined) {
          tokenBars.push({
            timestamp: ts,
            open: price,
            high: price,
            low: price,
            close: price,
            tokenId,
            market
          });
        }
      }
      this.bars.set(tokenId, tokenBars);
      this.barHistory.set(tokenId, []);
      if (tokenBars.length > this.maxBars) {
        this.maxBars = tokenBars.length;
      }
    }
  }
  findMarketForToken(tokenId) {
    return this.data.markets.find((m) => m.tokens.some((t) => t.token_id === tokenId));
  }
  run() {
    const ctx = this.createContext();
    this.strategy.onInit(ctx);
    const tokenIds = Array.from(this.bars.keys());
    for (let i = 0;i < this.maxBars; i++) {
      this.currentBarIndex = i;
      const currentPrices = new Map;
      for (const tokenId of tokenIds) {
        const tokenBars = this.bars.get(tokenId);
        if (tokenBars && tokenBars[i]) {
          const bar = tokenBars[i];
          this.currentBar = bar;
          currentPrices.set(tokenId, bar.close);
          const history = this.barHistory.get(tokenId) ?? [];
          history.push(bar);
          this.barHistory.set(tokenId, history);
          this.strategy.onNext(ctx, bar);
        }
      }
      this.portfolio.updatePositionValues(currentPrices);
    }
    return this.calculateResult();
  }
  createContext() {
    const self = this;
    const portfolioAPI = {
      getPosition(tokenId) {
        return self.portfolio.getPosition(tokenId);
      },
      getAllPositions() {
        return self.portfolio.getAllPositions();
      },
      getTotalValue() {
        const prices = new Map;
        for (const [tokenId, bars] of self.bars) {
          if (bars[self.currentBarIndex]) {
            prices.set(tokenId, bars[self.currentBarIndex].close);
          }
        }
        return self.portfolio.getTotalValue(prices);
      },
      getPnL() {
        const prices = new Map;
        for (const [tokenId, bars] of self.bars) {
          if (bars[self.currentBarIndex]) {
            prices.set(tokenId, bars[self.currentBarIndex].close);
          }
        }
        return self.portfolio.getPnL(prices);
      }
    };
    const dataAPI = {
      getBar(tokenId, offset = 0) {
        const history = self.barHistory.get(tokenId);
        if (!history)
          return;
        const idx = history.length - 1 - offset;
        return idx >= 0 ? history[idx] : undefined;
      },
      getHistory(tokenId, length) {
        const history = self.barHistory.get(tokenId) ?? [];
        if (length === undefined)
          return [...history];
        return history.slice(-length);
      }
    };
    return {
      portfolio: portfolioAPI,
      data: dataAPI,
      buy(tokenId, size) {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: "BUY",
            size: 0,
            price: 0,
            totalCost: 0,
            error: "No current bar"
          };
        }
        const price = bar.close;
        return self.portfolio.buy(tokenId, size, price, bar.timestamp);
      },
      sell(tokenId, size) {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: "SELL",
            size: 0,
            price: 0,
            totalCost: 0,
            error: "No current bar"
          };
        }
        const price = bar.close;
        return self.portfolio.sell(tokenId, size, price, bar.timestamp);
      },
      close(tokenId) {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: "SELL",
            size: 0,
            price: 0,
            totalCost: 0,
            error: "No current bar"
          };
        }
        const price = bar.close;
        return self.portfolio.close(tokenId, price, bar.timestamp);
      },
      getPosition(tokenId) {
        return self.portfolio.getPosition(tokenId);
      },
      getCapital() {
        return self.portfolio.getCapital();
      },
      getCurrentPrice(tokenId) {
        const bar = self.currentBar;
        if (!bar || bar.tokenId !== tokenId) {
          const bars = self.bars.get(tokenId);
          if (bars && bars[self.currentBarIndex]) {
            return bars[self.currentBarIndex].close;
          }
          return 0;
        }
        return bar.close;
      },
      getCurrentBar() {
        return self.currentBar;
      }
    };
  }
  calculateResult() {
    const tradeHistory = this.portfolio.getTradeHistory();
    const finalPrices = new Map;
    for (const [tokenId, bars] of this.bars) {
      if (bars.length > 0) {
        finalPrices.set(tokenId, bars[bars.length - 1].close);
      }
    }
    const finalCapital = this.portfolio.getTotalValue(finalPrices);
    const totalReturn = finalCapital - this.config.initialCapital;
    const totalReturnPercent = totalReturn / this.config.initialCapital * 100;
    const values = [];
    let runningValue = this.config.initialCapital;
    let maxValue = runningValue;
    let maxDrawdown = 0;
    for (const trade of tradeHistory) {
      const pos = this.portfolio.getPosition(trade.tokenId);
      const price = finalPrices.get(trade.tokenId) ?? trade.price;
      if (trade.side === "SELL") {
        runningValue = trade.capitalAfter;
      } else {
        runningValue = trade.capitalAfter;
      }
      if (pos) {
        runningValue += pos.size * price;
      }
      values.push(runningValue);
      if (runningValue > maxValue) {
        maxValue = runningValue;
      }
      const drawdown = (maxValue - runningValue) / maxValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    let sharpeRatio = 0;
    if (values.length > 1) {
      const returns = [];
      for (let i = 1;i < values.length; i++) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(252) : 0;
    }
    let winningTrades = 0;
    let losingTrades = 0;
    let totalBuyCost = new Map;
    let totalBuySize = new Map;
    for (const trade of tradeHistory) {
      if (trade.side === "BUY") {
        const prevCost = totalBuyCost.get(trade.tokenId) ?? 0;
        const prevSize = totalBuySize.get(trade.tokenId) ?? 0;
        totalBuyCost.set(trade.tokenId, prevCost + trade.totalCost);
        totalBuySize.set(trade.tokenId, prevSize + trade.size);
      } else {
        const avgBuyPrice = (totalBuyCost.get(trade.tokenId) ?? 0) / (totalBuySize.get(trade.tokenId) ?? 1);
        const sellPrice = trade.price;
        if (sellPrice >= avgBuyPrice) {
          winningTrades++;
        } else {
          losingTrades++;
        }
        totalBuyCost.delete(trade.tokenId);
        totalBuySize.delete(trade.tokenId);
      }
    }
    return {
      finalCapital,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      totalTrades: tradeHistory.length,
      winningTrades,
      losingTrades,
      positions: this.portfolio.getAllPositions(),
      tradeHistory
    };
  }
}
function loadStoredData(filePath) {
  const fs = __require("fs");
  const path = __require("path");
  const BSON = require_bson();
  const content = fs.readFileSync(filePath, "utf8");
  let manifest = null;
  try {
    manifest = JSON.parse(content);
  } catch {}
  if (manifest && manifest.metadata) {
    const dir = path.dirname(filePath);
    const metadataBuffer = fs.readFileSync(path.join(dir, manifest.metadata));
    const metadata = BSON.deserialize(metadataBuffer);
    const markets = [];
    for (const chunkFile of manifest.markets) {
      const chunkBuffer = fs.readFileSync(path.join(dir, chunkFile));
      const chunk = BSON.deserialize(chunkBuffer);
      if (chunk.markets) {
        markets.push(...chunk.markets);
      }
    }
    const priceHistory2 = new Map;
    for (const chunkFile of manifest.priceHistory) {
      const chunkBuffer = fs.readFileSync(path.join(dir, chunkFile));
      const chunk = BSON.deserialize(chunkBuffer);
      if (chunk.priceHistory) {
        for (const [key, value] of Object.entries(chunk.priceHistory)) {
          priceHistory2.set(key, value);
        }
      }
    }
    return {
      markets,
      priceHistory: priceHistory2,
      collectionMetadata: metadata.collectionMetadata ?? {
        collectedAt: "",
        version: "1.0.0",
        totalMarkets: markets.length,
        totalPricePoints: Array.from(priceHistory2.values()).reduce((sum, h) => sum + h.length, 0)
      }
    };
  }
  const buffer = fs.readFileSync(filePath);
  const raw = BSON.deserialize(buffer);
  const priceHistory = new Map;
  if (raw.priceHistory) {
    if (raw.priceHistory instanceof Map) {
      for (const [key, value] of raw.priceHistory) {
        priceHistory.set(key, value);
      }
    } else {
      for (const key of Object.keys(raw.priceHistory)) {
        priceHistory.set(key, raw.priceHistory[key]);
      }
    }
  }
  return {
    markets: raw.markets ?? [],
    priceHistory,
    collectionMetadata: raw.collectionMetadata ?? {
      collectedAt: "",
      version: "1.0.0",
      totalMarkets: 0,
      totalPricePoints: 0
    }
  };
}

// scripts/run-backtest.ts
import * as fs11 from "fs";
import * as path11 from "path";
kleur_default.enabled = true;
var DEFAULT_DATA_FILE = "data/polymarket-data.bson";
function loadSavedParams11(paramsFile) {
  const paramsPath = path11.join(process.cwd(), paramsFile);
  if (!fs11.existsSync(paramsPath))
    return null;
  try {
    const content = fs11.readFileSync(paramsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
var strategies = {
  simple_ma: {
    name: "Simple MA (01)",
    getStrategy: (params) => new ((init_strat_simple_ma_01(), __toCommonJS(exports_strat_simple_ma_01))).SimpleMAStrategy(params),
    paramsFile: "src/strategies/strat_simple_ma_01.params.json"
  },
  bollinger: {
    name: "Bollinger Bands (02)",
    getStrategy: (params) => new ((init_strat_bollinger_02(), __toCommonJS(exports_strat_bollinger_02))).BollingerBandsStrategy(params),
    paramsFile: "src/strategies/strat_bollinger_02.params.json"
  },
  rsi: {
    name: "RSI Mean Reversion (03)",
    getStrategy: (params) => new ((init_strat_rsi_03(), __toCommonJS(exports_strat_rsi_03))).RSIMeanReversionStrategy(params),
    paramsFile: "src/strategies/strat_rsi_03.params.json"
  },
  breakout: {
    name: "Price Breakout (04)",
    getStrategy: (params) => new ((init_strat_atr_breakout_04(), __toCommonJS(exports_strat_atr_breakout_04))).ATRBreakoutStrategy(params),
    paramsFile: "src/strategies/strat_atr_breakout_04.params.json"
  },
  ma_vol: {
    name: "MA + Volatility Stop (05)",
    getStrategy: (params) => new ((init_strat_ma_atr_05(), __toCommonJS(exports_strat_ma_atr_05))).MAStrategyWithATRStop(params),
    paramsFile: "src/strategies/strat_ma_atr_05.params.json"
  },
  support: {
    name: "Support/Resistance (06)",
    getStrategy: (params) => new ((init_strat_support_06(), __toCommonJS(exports_strat_support_06))).SupportResistanceStrategy(params),
    paramsFile: "src/strategies/strat_support_06.params.json"
  },
  momentum: {
    name: "Momentum (07)",
    getStrategy: (params) => new ((init_strat_momentum_07(), __toCommonJS(exports_strat_momentum_07))).ShortTermStrategy(params),
    paramsFile: "src/strategies/strat_momentum_07.params.json"
  },
  range: {
    name: "Range Trading (08)",
    getStrategy: (params) => new ((init_strat_range_08(), __toCommonJS(exports_strat_range_08))).RangeTradingStrategy(params),
    paramsFile: "src/strategies/strat_range_08.params.json"
  },
  mean_revert: {
    name: "Mean Reversion (09)",
    getStrategy: (params) => new ((init_strat_mean_revert_09(), __toCommonJS(exports_strat_mean_revert_09))).MeanReversionStrategy(params),
    paramsFile: "src/strategies/strat_mean_revert_09.params.json"
  },
  dual_ma: {
    name: "Dual MA + Trend (10)",
    getStrategy: (params) => new ((init_strat_dual_ma_10(), __toCommonJS(exports_strat_dual_ma_10))).DualMAStrategy(params),
    paramsFile: "src/strategies/strat_dual_ma_10.params.json"
  }
};
async function runBacktest(strategyInfo, data, options, savedParams) {
  const strategy = strategyInfo.getStrategy(savedParams || {});
  const config = {
    initialCapital: parseFloat(options.capital),
    feeRate: parseFloat(options.fee) / 100,
    slippage: 0
  };
  const engine = new BacktestEngine(data, strategy, config);
  const result = engine.run();
  return { result, params: savedParams };
}
function printComparison(results) {
  const col = (s, w) => s.toString().padEnd(w).slice(0, w);
  console.log(`
` + kleur_default.bold(kleur_default.cyan("=".repeat(100))));
  console.log(kleur_default.bold(kleur_default.cyan("STRATEGY COMPARISON")));
  console.log(kleur_default.bold(kleur_default.cyan("=".repeat(100))));
  const header = col("Strategy", 20) + col("Final Capital", 14) + col("Return", 12) + col("Drawdown", 12) + col("Sharpe", 10) + col("Trades", 8) + col("Win Rate", 10);
  console.log(kleur_default.bold(header));
  console.log("-".repeat(100));
  for (const { strategy, result } of results) {
    const winRate = result.totalTrades > 0 ? (result.winningTrades / (result.winningTrades + result.losingTrades) * 100).toFixed(1) + "%" : "-";
    const row = col(strategy, 20) + col("$" + result.finalCapital.toFixed(2), 14) + col("$" + result.totalReturn.toFixed(2) + " (" + result.totalReturnPercent.toFixed(2) + "%)", 12) + col("-" + result.maxDrawdown.toFixed(2) + "%", 12) + col(result.sharpeRatio.toFixed(3), 10) + col(result.totalTrades.toString(), 8) + col(winRate, 10);
    const isBest = result.totalReturn === Math.max(...results.map((r) => r.result.totalReturn));
    console.log(isBest ? kleur_default.green(row) : row);
  }
  console.log("-".repeat(100));
  const best = results.reduce((a, b) => a.result.totalReturn > b.result.totalReturn ? a : b);
  console.log(kleur_default.green(`
\u2605 Best: ${best.strategy} with $${best.result.totalReturn.toFixed(2)} return`));
}
var program2 = new Command;
program2.name("backtest").description("Polymarket Backtest Runner").option("-s, --strategy <name>", "Strategy to use (all, simple_ma, bollinger, rsi, breakout, ma_vol, support, momentum, range, mean_revert, dual_ma)", "all").option("-d, --data <file>", "Data file path", DEFAULT_DATA_FILE).option("-c, --capital <number>", "Initial capital in USD", "1000").option("-f, --fee <percent>", "Fee rate as percentage", "0").option("--fast <number>", "Fast MA period", "50").option("--slow <number>", "Slow MA period", "200").option("--stop-loss <percent>", "Stop loss as percentage", "2").option("--risk-percent <percent>", "Risk percent", "95").option("-t, --trailing-stop", "Enable trailing stop").option("-v, --verbose", "Show detailed trade history for each strategy").action(async (options) => {
  console.log(kleur_default.cyan("Polymarket Backtest Runner"));
  console.log(kleur_default.cyan("=========================="));
  console.log(`Data file:       ${options.data}`);
  console.log(`Initial capital: $${options.capital}`);
  console.log(`Fee rate:        ${options.fee}%`);
  console.log("");
  try {
    console.log(kleur_default.yellow("Loading data..."));
    const data = loadStoredData(options.data);
    console.log(`Loaded ${data.markets.length} markets`);
    console.log(`Price history for ${data.priceHistory.size} tokens`);
    console.log("");
    const strategiesToRun = options.strategy === "all" ? Object.entries(strategies) : [[options.strategy, strategies[options.strategy]]];
    if (options.strategy !== "all" && !strategies[options.strategy]) {
      console.error(kleur_default.red(`Unknown strategy: ${options.strategy}`));
      console.log(`Available strategies: all, ${Object.keys(strategies).join(", ")}`);
      process.exit(1);
    }
    const results = [];
    for (const [key, strategyInfo] of strategiesToRun) {
      console.log(kleur_default.yellow(`Running ${strategyInfo.name}...`));
      const savedParams = loadSavedParams11(strategyInfo.paramsFile);
      const { result } = await runBacktest(strategyInfo, data, options, savedParams);
      results.push({ strategy: strategyInfo.name, result });
      if (options.strategy !== "all") {
        printComparison(results);
      }
    }
    if (options.strategy === "all") {
      printComparison(results);
    }
  } catch (error) {
    console.error(kleur_default.red("Error running backtest:"), error);
    process.exit(1);
  }
});
program2.parse();
