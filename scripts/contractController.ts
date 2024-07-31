import { toNano } from '@ton/core';
import { ThresholdContract } from '../wrappers/ThresholdContract';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const contractAddress = await ui.inputAddress("Contract address");

  const thresholdContract = provider.open(ThresholdContract.createFromAddress(contractAddress));

  const action = await ui.choose("Choose action", ["Set is_paused", "Set threshold", "Change admin"], (v) => v);
  switch (action) {
    case "Set is_paused":
      const is_paused = await ui.prompt("Pause contract?");
      await thresholdContract.sendIsPaused(provider.sender(), toNano('0.05'), is_paused);
      break
    case "Set threshold":
      const threshold = toNano(await ui.input("Threshold"));
      await thresholdContract.sendThreshold(provider.sender(), toNano('0.05'), threshold);
      break
    case "Change admin":
      const newAdmin = await ui.inputAddress("New admin");
      await thresholdContract.sendAdmin(provider.sender(), toNano('0.05'), newAdmin);
      break
  }
}

// EQCcD83Uzx5F3z-2CY76SxG_-orMQXJqsviGJIJ8NHDzlsNF
