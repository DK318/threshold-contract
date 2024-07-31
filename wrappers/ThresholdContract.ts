import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ThresholdContractConfig = { is_paused: boolean; threshold: bigint; admin: Address };

export function thresholdContractConfigToCell(config: ThresholdContractConfig): Cell {
  return beginCell()
    .storeBit(config.is_paused)
    .storeCoins(config.threshold)
    .storeAddress(config.admin)
    .endCell();
}

export class ThresholdContract implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

  static createFromAddress(address: Address) {
    return new ThresholdContract(address);
  }

  static createFromConfig(config: ThresholdContractConfig, code: Cell, workchain = 0) {
    const data = thresholdContractConfigToCell(config);
    const init = { code, data };
    return new ThresholdContract(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendIsPaused(provider: ContractProvider, via: Sender, value: bigint, is_paused: boolean) {
    const messageBody = beginCell()
      .storeUint(1, 32)
      .storeBit(is_paused)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody
    });
  }

  async sendThreshold(provider: ContractProvider, via: Sender, value: bigint, threshold: bigint) {
    const messageBody = beginCell()
      .storeUint(2, 32)
      .storeCoins(threshold)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody
    });
  }

  async sendAdmin(provider: ContractProvider, via: Sender, value: bigint, admin: Address) {
    const messageBody = beginCell()
      .storeUint(3, 32)
      .storeAddress(admin)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody
    });
  }
}
