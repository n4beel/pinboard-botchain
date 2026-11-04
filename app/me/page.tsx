"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useWriteContract } from "@/lib/useChainWrite";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import NoteCard from "@/components/corkboard/NoteCard";
import { PINBOARD_ABI } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import { PINNED_EVENT } from "@/lib/logs";
import { NoticeInfo } from "@/lib/pinboard";
import { humanizePinboardError } from "@/lib/errors";

export default function MePinboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { writeContractAsync } = useWriteContract();
  const chainId = activeBotChain.id;
  const deployed = isDeployed(chainId);
  const contractAddress = deployed ? getDeployment(chainId).address : undefined;

  const [notices, setNotices] = useState<NoticeInfo[]>([]);
  const [pendingBalance, setPendingBalance] = useState<bigint>(0n);
  const [nowSecs, setNowSecs] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [unpinningId, setUnpinningId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData() {
      if (!publicClient || !contractAddress || !address) {
        setLoading(false);
        return;
      }

      try {
        const block = await publicClient.getBlock();
        if (!cancelled) setNowSecs(block.timestamp);

        // 1. Pending balance to withdraw
        const pBal = (await publicClient.readContract({
          address: contractAddress,
          abi: PINBOARD_ABI,
          functionName: "pending",
          args: [address],
        })) as bigint;

        // 2. Notices posted by author
        const [ids, nData] = (await publicClient.readContract({
          address: contractAddress,
          abi: PINBOARD_ABI,
          functionName: "byAuthor",
          args: [address, 0n, 50n],
        })) as [readonly bigint[], readonly any[], bigint];

        const list: NoticeInfo[] = [];

        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const raw = nData[i];
          const postedBlock = Number(raw.postedBlock);
          let noticeText = "text unavailable";

          try {
            const logs = await publicClient.getLogs({
              address: contractAddress,
              event: PINNED_EVENT,
              fromBlock: BigInt(postedBlock),
              toBlock: BigInt(postedBlock),
            });
            const match = logs.find((l) => l.args.id === id);
            if (match && match.args.text) {
              noticeText = match.args.text;
            }
          } catch {}

          list.push({
            id,
            author: raw.author,
            expiresAt: BigInt(raw.expiresAt),
            deposit: BigInt(raw.deposit),
            postedBlock,
            topic: Number(raw.topic),
            open: Boolean(raw.open),
            text: noticeText,
          });
        }

        if (!cancelled) {
          setPendingBalance(pBal);
          setNotices(list);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load user notices:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadUserData();
    const interval = setInterval(loadUserData, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainId, contractAddress, address]);

  async function handleWithdraw() {
    if (!publicClient || !contractAddress) return;
    setError(null);
    setWithdrawing(true);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "withdraw",
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setPendingBalance(0n);
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleUnpin(id: bigint) {
    if (!publicClient || !contractAddress) return;
    setError(null);
    setUnpinningId(id);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "unpin",
        args: [id],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setNotices((prev) =>
        prev.map((n) => (n.id === id ? { ...n, open: false } : n))
      );
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setUnpinningId(null);
    }
  }

  return (
    <PageShell
      title="My Board Activity"
      subtitle="Manage the notices you have pinned, recover deposits, and withdraw sweep bounties or return credits."
      activeTab="me"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-[#FDF0ED] border border-[var(--danger)] text-[var(--danger)] text-xs font-semibold rounded-sm">
            {error}
          </div>
        )}

        {!isConnected ? (
          <div className="bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-default)] p-12 text-center rounded-sm">
            <p className="font-bold text-base">Wallet not connected</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Connect your wallet to inspect your notices and pending earnings.
            </p>
          </div>
        ) : (
          <>
            {/* Pending Balance & Withdrawal Box */}
            <Panel heading="Pending Balance">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Available to withdraw (refunds + sweep bounties):
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                    {formatEther(pendingBalance)} BOT
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={withdrawing}
                  disabled={pendingBalance === 0n || withdrawing}
                  onClick={handleWithdraw}
                >
                  Withdraw to Wallet
                </Button>
              </div>
            </Panel>

            {/* Author's Notices List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold">Your Notices ({notices.length})</h2>
                <Link href="/pin">
                  <Button variant="secondary" size="sm">+ Pin Another</Button>
                </Link>
              </div>

              {loading ? (
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-8 text-center text-sm rounded-sm">
                  Scanning your notices...
                </div>
              ) : notices.length === 0 ? (
                <div className="bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-default)] p-8 text-center rounded-sm">
                  <p className="font-bold text-sm">No notices pinned yet</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
                    Post a note on the board with a deposit.
                  </p>
                  <Link href="/pin">
                    <Button variant="primary" size="sm">Pin First Notice</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-2">
                  {notices.map((n) => (
                    <NoteCard
                      key={n.id.toString()}
                      notice={n}
                      nowSecs={nowSecs}
                      userAddress={address}
                      onUnpin={handleUnpin}
                      unpinning={unpinningId === n.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
