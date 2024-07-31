import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { ThresholdContract } from '../wrappers/ThresholdContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';

describe('ThresholdContract', () => {
  let codeThreshold: Cell;
  let codeMinter: Cell;
  let codeWallet: Cell;

  beforeAll(async () => {
    codeThreshold = await compile('ThresholdContract');
    codeMinter = await compile('JettonMinter');
    codeWallet = await compile('JettonWallet');
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let thresholdContract: SandboxContract<ThresholdContract>;

  let jettonAdmin: SandboxContract<TreasuryContract>;
  let jettonMinter: SandboxContract<JettonMinter>;

  let defaultThreshold: bigint = toNano('0.1');

  let senderJettons: bigint = toNano('100000');
  let jettonSender: SandboxContract<TreasuryContract>;
  let jettonSenderWallet: SandboxContract<JettonWallet>;

  let thresholdWallet: SandboxContract<JettonWallet>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');

    thresholdContract = blockchain.openContract(ThresholdContract.createFromConfig({
      is_paused: false,
      threshold: defaultThreshold,
      admin: deployer.address,
    }, codeThreshold));

    const deployResult = await thresholdContract.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: thresholdContract.address,
      deploy: true,
      success: true,
    });

    jettonAdmin = await blockchain.treasury('jettonAdmin');

    jettonMinter = blockchain.openContract(JettonMinter.createFromConfig({
      admin: jettonAdmin.address,
      content: jettonContentToCell({
        type: 1,
        uri: "https://testjetton.org/content.json"
      }),
      wallet_code: codeWallet
    }, codeMinter));

    const jettonDeployResult = await jettonMinter.sendDeploy(jettonAdmin.getSender(), toNano('0.05'));

    expect(jettonDeployResult.transactions).toHaveTransaction({
      from: jettonAdmin.address,
      to: jettonMinter.address,
      deploy: true,
      success: true,
    });

    jettonSender = await blockchain.treasury('jettonSender');
    jettonSenderWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(jettonSender.address)));
    await jettonMinter.sendMint(jettonAdmin.getSender(), jettonSender.address, senderJettons, toNano('0.05'), toNano('0.1'));

    const amount = await jettonSenderWallet.getJettonBalance();
    expect(amount).toEqual(senderJettons);

    thresholdWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(thresholdContract.address)));
  });

  it('should deploy', async () => {
    // the check is done inside beforeEach
    // blockchain and thresholdContract are ready to use
  });

  it('should receive jettons if amount is larger than threshold', async () => {
    const amount = defaultThreshold + toNano('0.01');
    await jettonSenderWallet.sendTransfer(
      jettonSender.getSender(),
      toNano('1'),
      amount,
      thresholdContract.address,
      thresholdContract.address,
      Cell.EMPTY,
      toNano('0.1'),
      Cell.EMPTY
    );

    expect(await thresholdWallet.getJettonBalance()).toEqual(amount);
    expect(await jettonSenderWallet.getJettonBalance()).toEqual(senderJettons - amount);
  });

  it('should not receive jettons if amount is less than threshold', async () => {
    const amount = defaultThreshold - toNano('0.01');
    await jettonSenderWallet.sendTransfer(
      jettonSender.getSender(),
      toNano('1'),
      amount,
      thresholdContract.address,
      thresholdContract.address,
      Cell.EMPTY,
      toNano('0.1'),
      Cell.EMPTY
    );

    expect(await thresholdWallet.getJettonBalance()).toEqual(0n);
    expect(await jettonSenderWallet.getJettonBalance()).toEqual(senderJettons);
  });

  it('should not receive jettons if the contract is paused', async () => {
    await thresholdContract.sendIsPaused(deployer.getSender(), toNano('0.1'), true);

    const amount = defaultThreshold + toNano('0.01');
    await jettonSenderWallet.sendTransfer(
      jettonSender.getSender(),
      toNano('1'),
      amount,
      thresholdContract.address,
      thresholdContract.address,
      Cell.EMPTY,
      toNano('0.1'),
      Cell.EMPTY
    );

    expect(await thresholdWallet.getJettonBalance()).toEqual(0n);
    expect(await jettonSenderWallet.getJettonBalance()).toEqual(senderJettons);
  });

  it('should not receive jettons on a higher threshold', async () => {
    const amount = defaultThreshold + toNano('0.01');
    await jettonSenderWallet.sendTransfer(
      jettonSender.getSender(),
      toNano('1'),
      amount,
      thresholdContract.address,
      thresholdContract.address,
      Cell.EMPTY,
      toNano('0.1'),
      Cell.EMPTY
    );

    expect(await thresholdWallet.getJettonBalance()).toEqual(amount);
    expect(await jettonSenderWallet.getJettonBalance()).toEqual(senderJettons - amount);

    await thresholdContract.sendThreshold(deployer.getSender(), toNano('0.1'), defaultThreshold * BigInt(2));
    await jettonSenderWallet.sendTransfer(
      jettonSender.getSender(),
      toNano('1'),
      amount,
      thresholdContract.address,
      thresholdContract.address,
      Cell.EMPTY,
      toNano('0.1'),
      Cell.EMPTY
    );

    expect(await thresholdWallet.getJettonBalance()).toEqual(amount);
    expect(await jettonSenderWallet.getJettonBalance()).toEqual(senderJettons - amount);
  });

  it('cannot change is_paused if sender is not an admin', async () => {
    const notAdmin = await blockchain.treasury('notAdmin');

    const changeResult = await thresholdContract.sendIsPaused(notAdmin.getSender(), toNano('0.1'), true);
    expect(changeResult.transactions).toHaveTransaction({
      from: notAdmin.address,
      to: thresholdContract.address,
      aborted: true,
      exitCode: 777
    });
  });

  it('cannot change threshold if sender is not an admin', async () => {
    const notAdmin = await blockchain.treasury('notAdmin');

    const changeResult = await thresholdContract.sendThreshold(notAdmin.getSender(), toNano('0.1'), toNano('0'));
    expect(changeResult.transactions).toHaveTransaction({
      from: notAdmin.address,
      to: thresholdContract.address,
      aborted: true,
      exitCode: 777
    });
  });

  it('cannot change admin if sender is not an admin', async () => {
    const notAdmin = await blockchain.treasury('notAdmin');

    const changeResult = await thresholdContract.sendAdmin(notAdmin.getSender(), toNano('0.1'), notAdmin.address);
    expect(changeResult.transactions).toHaveTransaction({
      from: notAdmin.address,
      to: thresholdContract.address,
      aborted: true,
      exitCode: 777
    });
  });

  it('can change admin if sender is an admin', async () => {
    const newAdmin = await blockchain.treasury('newAdmin');

    const changeResult = await thresholdContract.sendAdmin(deployer.getSender(), toNano('0.1'), newAdmin.address);
    expect(changeResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: thresholdContract.address,
      success: true,
    });

    const failedPausedResult = await thresholdContract.sendIsPaused(deployer.getSender(), toNano('0.1'), true);
    expect(failedPausedResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: thresholdContract.address,
      aborted: true,
      exitCode: 777
    });

    const successPausedResult = await thresholdContract.sendIsPaused(newAdmin.getSender(), toNano('0.1'), true);
    expect(successPausedResult.transactions).toHaveTransaction({
      from: newAdmin.address,
      to: thresholdContract.address,
      success: true,
    });
  });
});
