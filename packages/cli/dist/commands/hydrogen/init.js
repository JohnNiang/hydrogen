import Command from '@shopify/cli-kit/node/base-command';
import { Flags } from '@oclif/core';
import { AbortError } from '@shopify/cli-kit/node/error';
import { commonFlags, flagsToCamelObject, parseProcessFlags } from '../../lib/flags.js';
import { checkCurrentCLIVersion } from '../../lib/check-cli-version.js';
import { I18N_CHOICES } from '../../lib/setups/i18n/index.js';
import { supressNodeExperimentalWarnings } from '../../lib/process.js';
import { setupTemplate } from '../../lib/onboarding/index.js';
import { LANGUAGES } from '../../lib/onboarding/common.js';

const FLAG_MAP = { f: "force" };
class Init extends Command {
  static descriptionWithMarkdown = "Creates a new Hydrogen storefront.";
  static description = "Creates a new Hydrogen storefront.";
  static flags = {
    ...commonFlags.force,
    path: Flags.string({
      description: "The path to the directory of the new Hydrogen storefront.",
      env: "SHOPIFY_HYDROGEN_FLAG_PATH"
    }),
    language: Flags.string({
      description: "Sets the template language to use. One of `js` or `ts`.",
      choices: Object.keys(LANGUAGES),
      env: "SHOPIFY_HYDROGEN_FLAG_LANGUAGE"
    }),
    template: Flags.string({
      description: "Scaffolds project based on an existing template or example from the Hydrogen repository.",
      env: "SHOPIFY_HYDROGEN_FLAG_TEMPLATE"
    }),
    ...commonFlags.installDeps,
    "mock-shop": Flags.boolean({
      description: "Use mock.shop as the data source for the storefront.",
      env: "SHOPIFY_HYDROGEN_FLAG_MOCK_DATA"
    }),
    ...commonFlags.markets,
    ...commonFlags.shortcut,
    routes: Flags.boolean({
      description: "Generate routes for all pages.",
      env: "SHOPIFY_HYDROGEN_FLAG_ROUTES",
      allowNo: true
    }),
    git: Flags.boolean({
      description: "Init Git and create initial commits.",
      env: "SHOPIFY_HYDROGEN_FLAG_GIT",
      default: true,
      allowNo: true
    }),
    quickstart: Flags.boolean({
      description: "Scaffolds a new Hydrogen project with a set of sensible defaults. Equivalent to `shopify hydrogen init --path hydrogen-quickstart --mock-shop --language js --shortcut --routes --markets none`",
      env: "SHOPIFY_HYDROGEN_FLAG_QUICKSTART",
      default: false
    }),
    "package-manager": Flags.string({
      env: "SHOPIFY_HYDROGEN_FLAG_PACKAGE_MANAGER",
      hidden: true,
      options: ["npm", "yarn", "pnpm", "unknown"]
    })
  };
  async run() {
    const { flags } = await this.parse(Init);
    await runInit(flagsToCamelObject(flags));
  }
}
async function runInit({
  markets,
  ...options
} = parseProcessFlags(
  process.argv,
  FLAG_MAP
)) {
  supressNodeExperimentalWarnings();
  if (!options.i18n && markets) {
    options.i18n = markets;
  }
  if (options.i18n && !I18N_CHOICES.includes(options.i18n)) {
    throw new AbortError(
      `Invalid URL structure strategy: ${options.i18n}. Must be one of ${I18N_CHOICES.join(", ")}`
    );
  }
  options.git ??= true;
  if (options.quickstart) {
    options.i18n ??= "none";
    options.installDeps ??= true;
    options.language ??= "js";
    options.mockShop ??= true;
    options.path ??= "./hydrogen-quickstart";
    options.routes ??= true;
    options.shortcut ??= true;
  }
  const showUpgrade = await checkCurrentCLIVersion();
  if (showUpgrade) {
    showUpgrade(options.packageManager);
  }
  return setupTemplate(options);
}

export { Init as default, runInit };
