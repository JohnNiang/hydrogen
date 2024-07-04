import Command from '@shopify/cli-kit/node/base-command';
import { Flags } from '@oclif/core';
import { AbortError } from '@shopify/cli-kit/node/error';
import { outputDebug } from '@shopify/cli-kit/node/output';
import { linkStorefront } from '../link.js';
import { commonFlags, flagsToCamelObject } from '../../../lib/flags.js';
import { getCliCommand } from '../../../lib/shell.js';
import { login } from '../../../lib/auth.js';
import { setCustomerAccountConfig, getConfig } from '../../../lib/shopify-config.js';
import { replaceCustomerApplicationUrls } from '../../../lib/graphql/admin/customer-application-update.js';

class CustomerAccountPush extends Command {
  static description = "Push project configuration to admin";
  static flags = {
    ...commonFlags.path,
    "storefront-id": Flags.string({
      description: "The id of the storefront the configuration should be pushed to. Must start with 'gid://shopify/HydrogenStorefront/'"
    }),
    "dev-origin": Flags.string({
      description: "The development domain of your application.",
      required: true
    }),
    "relative-redirect-uri": Flags.string({
      description: "The relative url of allowed callback url for Customer Account API OAuth flow. Default is '/account/authorize'"
    }),
    "relative-logout-uri": Flags.string({
      description: "The relative url of allowed url that will be redirected to post-logout for Customer Account API OAuth flow. Default to nothing."
    })
  };
  async run() {
    const { flags } = await this.parse(CustomerAccountPush);
    await runCustomerAccountPush({ ...flagsToCamelObject(flags) });
  }
}
async function runCustomerAccountPush({
  path: root = process.cwd(),
  storefrontId: storefrontIdFromFlag,
  devOrigin,
  redirectUriRelativeUrl = "/account/authorize",
  logoutUriRelativeUrl
}) {
  const storefrontId = await getStorefrontId(root, storefrontIdFromFlag);
  try {
    if (!storefrontId) {
      throw new Error(
        "No storefrontId was found in --storefront-id flag or .shopify/project.json"
      );
    }
    const redirectUri = redirectUriRelativeUrl ? new URL(redirectUriRelativeUrl, devOrigin).toString() : devOrigin;
    const javascriptOrigin = devOrigin;
    const logoutUri = logoutUriRelativeUrl ? new URL(logoutUriRelativeUrl, devOrigin).toString() : devOrigin;
    if (!redirectUri && !javascriptOrigin && !logoutUri) {
      return;
    }
    const { session, config } = await login(root);
    const customerAccountConfig = config?.storefront?.customerAccountConfig;
    const { success, userErrors } = await replaceCustomerApplicationUrls(
      session,
      storefrontId,
      {
        redirectUri: {
          add: redirectUri ? [redirectUri] : void 0,
          removeRegex: customerAccountConfig?.redirectUri
        },
        javascriptOrigin: {
          add: javascriptOrigin ? [javascriptOrigin] : void 0,
          removeRegex: customerAccountConfig?.javascriptOrigin
        },
        logoutUris: {
          add: logoutUri ? [logoutUri] : void 0,
          removeRegex: customerAccountConfig?.logoutUri
        }
      }
    );
    if (!success || userErrors.length) {
      const error = new Error(
        "Customer Account Application setup update fail."
      );
      error.userErrors = userErrors;
      throw error;
    }
    await setCustomerAccountConfig(root, {
      redirectUri,
      javascriptOrigin,
      logoutUri
    });
    return () => cleanupCustomerApplicationUrls(session, storefrontId, {
      redirectUri,
      javascriptOrigin,
      logoutUri
    });
  } catch (error) {
    let confidentialAccessFound = false;
    const errors = error?.userErrors?.length ? error.userErrors.map(
      (value) => {
        if (/Javascript origin is not allowed for this application type/i.test(
          value.message
        )) {
          confidentialAccessFound = true;
        }
        return `${value.field}: ${value.message}`;
      }
    ) : error.message ? [error.message] : [];
    const nextSteps = [
      {
        link: {
          label: "Manually update application setup",
          url: "https://shopify.dev/docs/custom-storefronts/building-with-the-customer-account-api/hydrogen#update-the-application-setup"
        }
      }
    ];
    if (confidentialAccessFound) {
      nextSteps.unshift({
        link: {
          label: "Enable Public access for Hydrogen",
          url: "https://shopify.dev/docs/custom-storefronts/building-with-the-customer-account-api/getting-started#step-1-enable-customer-account-api-access"
        }
      });
    }
    throw new AbortError(
      "Customer Account Application setup update fail.",
      errors.length ? [
        {
          list: {
            title: "The following error occurs during update:",
            items: errors.map(
              (value, index) => `${index != 0 ? "\n\n" : ""}${value}`
            )
          }
        }
      ] : void 0,
      nextSteps
    );
  }
}
async function cleanupCustomerApplicationUrls(session, storefrontId, customerAccountConfig = {}) {
  if (!Object.values(customerAccountConfig).some(Boolean)) return;
  outputDebug(
    `Cleaning up Customer Application url "${customerAccountConfig.redirectUri}"`
  );
  await replaceCustomerApplicationUrls(session, storefrontId, {
    redirectUri: { removeRegex: customerAccountConfig?.redirectUri },
    javascriptOrigin: { removeRegex: customerAccountConfig?.javascriptOrigin },
    logoutUris: { removeRegex: customerAccountConfig?.logoutUri }
  }).catch((error) => {
    outputDebug(
      `Failed to clean up Customer Application url "${customerAccountConfig.redirectUri}":
${error?.message}`
    );
  });
}
async function getStorefrontId(root, storefrontIdFromFlag) {
  if (storefrontIdFromFlag) return storefrontIdFromFlag;
  const { session, config } = await login(root);
  if (config.storefront?.id) return config.storefront.id;
  const cliCommand = await getCliCommand();
  const linkedStore = await linkStorefront(root, session, config, {
    cliCommand
  });
  if (!linkedStore) {
    return;
  }
  const newConfig = await getConfig(root);
  return newConfig.storefront?.id;
}

export { CustomerAccountPush as default, getStorefrontId, runCustomerAccountPush };
