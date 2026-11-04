#!/usr/bin/env node
import { spawn } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const PORT = 8754;
const RPC_URL = `http://127.0.0.1:${PORT}`;

// 10 default anvil accounts
const PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Author A
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Author B
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Author C
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Sweeper
  "0x47e179ec197488593b100287e941669c6bf3605b514b4aeeb33a498f8b3384b8", // 4: Outsider
];

async function main() {
  console.log(`Starting Anvil on port ${PORT}...`);
  const anvil = spawn("anvil", ["--port", String(PORT), "--silent"], {
    stdio: "inherit",
  });

  process.on("SIGINT", () => {
    anvil.kill();
    process.exit();
  });
  process.on("SIGTERM", () => {
    anvil.kill();
    process.exit();
  });

  const publicClient = createPublicClient({
    transport: http(RPC_URL),
  });

  // Wait for anvil
  for (let i = 0; i < 40; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const accounts = PRIVATE_KEYS.map((pk) => privateKeyToAccount(pk as `0x${string}`));
  const clients = accounts.map((account) =>
    createWalletClient({
      account,
      transport: http(RPC_URL),
    })
  );

  // Deploy contract
  const artifactPath = resolve(process.cwd(), "contracts/out/Pinboard.sol/Pinboard.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode.object as `0x${string}`;
  const abi = artifact.abi;

  const deployHash = await clients[0].deployContract({
    abi,
    bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress as Address;

  console.log(`Pinboard deployed at: ${contractAddress}`);

  // Write .env.local
  const envContent = [
    `NEXT_PUBLIC_CONTRACT_31337=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_31337=1`,
    `NEXT_PUBLIC_RPC_URL_31337=${RPC_URL}`,
    "",
  ].join("\n");
  writeFileSync(resolve(process.cwd(), ".env.local"), envContent);
  console.log("Updated .env.local with local stack contract address");

  // Seed 12 notices across topics (§5):
  // 6 open, 2 about to expire, 2 expired and sweepable, 1 taken down, 1 swept
  const seeds = [
    // 6 Open (long TTL)
    { client: clients[0], topic: 0, text: "Road bike, carbon frame, 54cm. DM for test ride.", dep: "0.5", ttl: 86400 * 7 },
    { client: clients[1], topic: 1, text: "Looking for mechanical keyboard switches (Gateron yellow).", dep: "0.1", ttl: 86400 * 5 },
    { client: clients[2], topic: 2, text: "Community Chess Tournament this Saturday at 2pm!", dep: "0.25", ttl: 86400 * 4 },
    { client: clients[0], topic: 3, text: "Found black tortoiseshell cat near park playground.", dep: "0.05", ttl: 86400 * 3 },
    { client: clients[1], topic: 4, text: "Free sourdough starter discard. Bring your own jar.", dep: "0.02", ttl: 86400 * 6 },
    { client: clients[2], topic: 5, text: "Water shutoff for scheduled pipe repairs next Tuesday 9-11am.", dep: "0.1", ttl: 86400 * 10 },
    // 2 About to expire (1 hour TTL)
    { client: clients[0], topic: 6, text: "Barista needed for weekend morning shifts. Great team!", dep: "0.15", ttl: 3600 },
    { client: clients[1], topic: 7, text: "Book exchange box filled with new sci-fi novels.", dep: "0.05", ttl: 3700 },
    // 2 Expired & Sweepable (we will mine past their expiry)
    { client: clients[2], topic: 0, text: "Old wooden coffee table, free for pickup today only.", dep: "0.2", ttl: 3600 },
    { client: clients[0], topic: 1, text: "Wanted: spare HDMI monitor cable.", dep: "0.05", ttl: 3600 },
    // 1 Taken down (Unpinned)
    { client: clients[1], topic: 0, text: "Vintage record player — SOLD, taking notice down.", dep: "0.5", ttl: 86400 },
    // 1 Swept
    { client: clients[2], topic: 2, text: "Last month concert tickets announcement (historical).", dep: "0.3", ttl: 3600 },
  ];

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const tx = await s.client.writeContract({
      address: contractAddress,
      abi,
      functionName: "pin",
      args: [s.topic, s.text, BigInt(s.ttl)],
      value: parseEther(s.dep),
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  // Notice 11: author unpins it
  const unpinTx = await clients[1].writeContract({
    address: contractAddress,
    abi,
    functionName: "unpin",
    args: [11n],
  });
  await publicClient.waitForTransactionReceipt({ hash: unpinTx });

  // Advance time past 3600 seconds to make notices 9, 10, 12 expired
  await publicClient.request({
    // @ts-expect-error Anvil RPC
    method: "evm_increaseTime",
    params: [3800],
  });
  await publicClient.request({
    // @ts-expect-error Anvil RPC
    method: "evm_mine",
    params: [],
  });

  // Notice 12: Sweeper sweeps it
  const sweepTx = await clients[3].writeContract({
    address: contractAddress,
    abi,
    functionName: "sweep",
    args: [12n],
  });
  await publicClient.waitForTransactionReceipt({ hash: sweepTx });

  console.log("Seeding complete! 12 notices seeded with varied states.");
  console.log("Local stack ready at http://localhost:3000 (running against port 8754)");
}

main().catch(console.error);
