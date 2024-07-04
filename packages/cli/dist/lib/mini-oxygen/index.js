import { importLocal } from '../import-utils.js';
import { handleMiniOxygenImportFail } from './common.js';
export { DEFAULT_INSPECTOR_PORT } from './common.js';

async function buildAssetsUrl(port, root) {
  const { buildAssetsUrl: _buildAssetsUrl } = await importLocal(
    "@shopify/mini-oxygen",
    root
  ).catch(handleMiniOxygenImportFail);
  return _buildAssetsUrl(port);
}
async function startMiniOxygen(options, useNodeRuntime = false) {
  if (useNodeRuntime) {
    process.env.MINIFLARE_SUBREQUEST_LIMIT = 100;
    const { startNodeServer } = await import('./node.js');
    return startNodeServer(options);
  }
  const { startWorkerdServer } = await import('./workerd.js');
  return startWorkerdServer(options);
}

export { buildAssetsUrl, startMiniOxygen };
