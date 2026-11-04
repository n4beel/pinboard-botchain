"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useWriteContract } from "@/lib/useChainWrite";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { PINBOARD_ABI } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import { TOPIC_NAMES, byteLength, bounty, returned } from "@/lib/pinboard";
import { humanizePinboardError } from "@/lib/errors";

export default function PinNoticePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { writeContractAsync } = useWriteContract();
  const chainId = activeBotChain.id;
  const deployed = isDeployed(chainId);
  const contractAddress = deployed ? getDeployment(chainId).address : undefined;

  const [topic, setTopic] = useState<number>(0);
  const [text, setText] = useState("");
  const [ttlHours, setTtlHours] = useState("24");
  const [deposit, setDeposit] = useState("0.1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBytes = byteLength(text);
  const depositWei = (() => {
    try {
      return parseEther(deposit || "0");
    } catch {
      return 0n;
    }
  })();
  const bountyPreview = bounty(depositWei);
  const returnPreview = returned(depositWei);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient || !contractAddress) return;

    setError(null);
    setSubmitting(true);

    try {
      if (text.trim().length === 0) {
        throw new Error("Notice text cannot be empty.");
      }
      if (currentBytes > 200) {
        throw new Error(`Text is ${currentBytes} bytes; the limit is 200.`);
      }

      const hrs = parseFloat(ttlHours);
      if (isNaN(hrs) || hrs < 1 || hrs > 720) {
        throw new Error("Duration must be between 1 hour and 720 hours (30 days).");
      }
      const ttlSecs = BigInt(Math.round(hrs * 3600));

      if (depositWei < parseEther("0.01") || depositWei > parseEther("100")) {
        throw new Error("Deposit must be between 0.01 BOT and 100 BOT.");
      }

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "pin",
        args: [topic, text.trim(), ttlSecs],
        value: depositWei,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      const count = (await publicClient.readContract({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "noticeCount",
      })) as bigint;

      router.push(`/notice/${count.toString()}`);
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Pin a Notice"
      subtitle="Post a notice with a deposit. Take it down to recover 100% of it, or let it expire."
      activeTab="pin"
    >
      <div className="max-w-xl mx-auto space-y-6">
        <Panel heading="New Notice Note">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-[#FDF0ED] border border-[var(--danger)] text-[var(--danger)] text-xs font-semibold rounded-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="topic" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                Category
              </label>
              <select
                id="topic"
                value={topic}
                onChange={(e) => setTopic(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--menu-bg)] text-[var(--menu-fg)] border border-[var(--menu-border)] text-sm rounded-sm outline-none"
              >
                {TOPIC_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="text" className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Notice Text
                </label>
                <span
                  className={`text-xs font-mono font-medium ${
                    currentBytes > 200 ? "text-[var(--danger)] font-bold" : "text-[var(--text-muted)]"
                  }`}
                >
                  {currentBytes} / 200 bytes
                </span>
              </div>
              <textarea
                id="text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your note clearly. Text will be readable on the corkboard..."
                required
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm rounded-sm outline-none focus:border-[var(--border-strong)] font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ttlHours" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Duration (Hours)
                </label>
                <input
                  id="ttlHours"
                  type="number"
                  step="any"
                  min="1"
                  max="720"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm rounded-sm outline-none"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">1h to 720h (30 days)</p>
              </div>

              <div>
                <label htmlFor="deposit" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Deposit (BOT)
                </label>
                <input
                  id="deposit"
                  type="number"
                  step="any"
                  min="0.01"
                  max="100"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm font-mono rounded-sm outline-none"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Min 0.01 &middot; Max 100 BOT</p>
              </div>
            </div>

            {/* Spec §3.4: Copy requirement */}
            <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] rounded-sm space-y-1">
              <p className="font-semibold text-[var(--text-primary)]">
                Deposit {deposit || "0"} BOT. Take it down any time for all of it back.
              </p>
              <p>
                If it expires without being taken down, a sweeper can clear it to claim a 20% bounty ({depositWei > 0n ? (Number(bountyPreview) / 1e18).toFixed(4) : "0"} BOT), and {depositWei > 0n ? (Number(returnPreview) / 1e18).toFixed(4) : "0"} BOT will be returned to your pending balance.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={!isConnected || submitting || currentBytes > 200}
              className="w-full"
            >
              {!isConnected ? "Connect Wallet to Pin" : "Pin Notice to Board"}
            </Button>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
