import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Address,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PINBOARD_ABI } from "../../lib/botchain/abi";
import { PINNED_EVENT } from "../../lib/logs";
import { readFileSync } from "fs";
import { resolve } from "path";

const ANVIL_PORT = 8654;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// Anvil default accounts
const ALICE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Account 0
const BOB_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";   // Account 1
const SWEEPER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Account 2

const aliceAccount = privateKeyToAccount(ALICE_KEY);
const bobAccount = privateKeyToAccount(BOB_KEY);
const sweeperAccount = privateKeyToAccount(SWEEPER_KEY);

describe("Pinboard integration test (Anvil)", () => {
  let anvilProcess: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  const aliceClient = createWalletClient({
    account: aliceAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const sweeperClient = createWalletClient({
    account: sweeperAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  beforeAll(async () => {
    anvilProcess = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
      stdio: "ignore",
    });

    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        await publicClient.getBlockNumber();
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!connected) throw new Error("Could not connect to Anvil on port " + ANVIL_PORT);

    const artifactPath = resolve(__dirname, "../../contracts/out/Pinboard.sol/Pinboard.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const bytecode = artifact.bytecode.object as `0x${string}`;

    const deployHash = await aliceClient.deployContract({
      abi: PINBOARD_ABI,
      bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!receipt.contractAddress) throw new Error("Contract deployment failed");
    contractAddress = receipt.contractAddress;
  }, 20000);

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("executes the full cycle: pin -> read log text -> expire -> sweep -> withdraw both", async () => {
    const deposit = parseEther("1");
    const ttl = 3600n; // 1 hour
    const text = "Vintage leather armchair in great shape!";

    // 1. Alice pins notice
    const pinHash = await aliceClient.writeContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "pin",
      args: [0, text, ttl],
      value: deposit,
    });
    const pinReceipt = await publicClient.waitForTransactionReceipt({ hash: pinHash });
    expect(pinReceipt.status).toBe("success");

    // 2. Read notice from contract and log
    const notice = await publicClient.readContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "noticeOf",
      args: [1n],
    });
    expect(notice.author.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(notice.open).toBe(true);
    expect(notice.deposit).toBe(deposit);

    // Read log text from posted block
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: PINNED_EVENT,
      fromBlock: pinReceipt.blockNumber,
      toBlock: pinReceipt.blockNumber,
    });
    expect(logs.length).toBe(1);
    expect(logs[0].args.text).toBe(text);

    // 3. Advance time past expiry
    await (publicClient.request as any)({
      method: "evm_increaseTime",
      params: [3700],
    });
    await (publicClient.request as any)({
      method: "evm_mine",
      params: [],
    });

    // 4. Sweeper checks sweepable list
    const sweepableRes = await publicClient.readContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "sweepable",
      args: [0n, 10n],
    });
    expect(sweepableRes[1]).toBe(1n);
    expect(sweepableRes[0][0]).toBe(1n);

    // 5. Sweeper sweeps notice
    const sweepHash = await sweeperClient.writeContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "sweep",
      args: [1n],
    });
    const sweepReceipt = await publicClient.waitForTransactionReceipt({ hash: sweepHash });
    expect(sweepReceipt.status).toBe("success");

    // 20% bounty to sweeper, 80% remainder to Alice
    const sweeperPending = await publicClient.readContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "pending",
      args: [sweeperAccount.address],
    });
    expect(sweeperPending).toBe(parseEther("0.2"));

    const alicePending = await publicClient.readContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "pending",
      args: [aliceAccount.address],
    });
    expect(alicePending).toBe(parseEther("0.8"));

    // 6. Both withdraw
    const aliceBalBefore = await publicClient.getBalance({ address: aliceAccount.address });
    const aliceWithdrawHash = await aliceClient.writeContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "withdraw",
    });
    const aliceWithdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: aliceWithdrawHash });
    const aliceGas = aliceWithdrawReceipt.gasUsed * aliceWithdrawReceipt.effectiveGasPrice;
    const aliceBalAfter = await publicClient.getBalance({ address: aliceAccount.address });
    expect(aliceBalAfter).toBe(aliceBalBefore + parseEther("0.8") - aliceGas);

    const sweeperBalBefore = await publicClient.getBalance({ address: sweeperAccount.address });
    const sweeperWithdrawHash = await sweeperClient.writeContract({
      address: contractAddress,
      abi: PINBOARD_ABI,
      functionName: "withdraw",
    });
    const sweeperWithdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: sweeperWithdrawHash });
    const sweeperGas = sweeperWithdrawReceipt.gasUsed * sweeperWithdrawReceipt.effectiveGasPrice;
    const sweeperBalAfter = await publicClient.getBalance({ address: sweeperAccount.address });
    expect(sweeperBalAfter).toBe(sweeperBalBefore + parseEther("0.2") - sweeperGas);
  });
});
