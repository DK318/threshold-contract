import { toNano } from '@ton/core';
import { ThresholdContract } from '../wrappers/ThresholdContract';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const threshold = toNano(await ui.input("Threshold"));
  const admin = await ui.inputAddress("Admin address");

  const thresholdContract = provider.open(ThresholdContract.createFromConfig({
    is_paused: false,
    threshold,
    admin,
  }, await compile('ThresholdContract')));

  await thresholdContract.sendDeploy(provider.sender(), toNano('0.05'));

  await provider.waitForDeploy(thresholdContract.address);

  // run methods on `thresholdContract`
}
