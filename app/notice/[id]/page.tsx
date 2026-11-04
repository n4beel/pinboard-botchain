"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { NoticeInfo, TOPIC_NAMES, timeLeft, bounty } from "@/lib/pinboard";
import { humanizePinboardError } from "@/lib/errors";

export default function NoticeDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  const noticeId = BigInt(rawId || "0");

  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { writeContractAsync } = useWriteContract();
  const chainId = activeBotChain.id;
  const deployed = isDeployed(chainId);
  const contractAddress = deployed ? getDeployment(chainId).address : undefined;

  const [notice, setNotice] = useState<NoticeInfo | null>(null);
  const [nowSecs, setNowSecs] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [loading, setLoading] = useState(true);
  const [renewHours, setRenewHours] = useState("24");
  const [renewing, setRenewing] = useState(false);
  const [unpinning, setUnpinning] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNotice() {
      if (!publicClient || !contractAddress || noticeId <= 0n) {
        setLoading(false);
        return;
      }

      try {
        const block = await publicClient.getBlock();
        if (!cancelled) setNowSecs(block.timestamp);

        const raw = (await publicClient.readContract({
          address: contractAddress,
          abi: PINBOARD_ABI,
          functionName: "noticeOf",
          args: [noticeId],
        })) as any;

        const postedBlock = Number(raw.postedBlock);
        let noticeText = "text unavailable";

        try {
          const logs = await publicClient.getLogs({
            address: contractAddress,
            event: PINNED_EVENT,
            fromBlock: BigInt(postedBlock),
            toBlock: BigInt(postedBlock),
          });
          const match = logs.find((l) => l.args.id === noticeId);
          if (match && match.args.text) {
            noticeText = match.args.text;
          }
        } catch {}

        if (!cancelled) {
          setNotice({
            id: noticeId,
            author: raw.author,
            expiresAt: BigInt(raw.expiresAt),
            deposit: BigInt(raw.deposit),
            postedBlock,
            topic: Number(raw.topic),
            open: Boolean(raw.open),
            text: noticeText,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load notice:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadNotice();
    const interval = setInterval(loadNotice, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainId, contractAddress, noticeId]);

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient || !contractAddress || !notice) return;

    setError(null);
    setRenewing(true);

    try {
      const hrs = parseFloat(renewHours);
      if (isNaN(hrs) || hrs < 1 || hrs > 720) {
        throw new Error("Renewal duration must be between 1 and 720 hours.");
      }
      const ttlSecs = BigInt(Math.round(hrs * 3600));

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "renew",
        args: [noticeId, ttlSecs],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      // Optimistic refresh
      setNotice((prev) => (prev ? { ...prev, expiresAt: nowSecs + ttlSecs } : prev));
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setRenewing(false);
    }
  }

  async function handleUnpin() {
    if (!publicClient || !contractAddress) return;
    setError(null);
    setUnpinning(true);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "unpin",
        args: [noticeId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice((prev) => (prev ? { ...prev, open: false } : prev));
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setUnpinning(false);
    }
  }

  async function handleSweep() {
    if (!publicClient || !contractAddress) return;
    setError(null);
    setSweeping(true);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "sweep",
        args: [noticeId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice((prev) => (prev ? { ...prev, open: false } : prev));
    } catch (err: any) {
      console.error(err);
      setError(humanizePinboardError(err));
    } finally {
      setSweeping(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="Loading Notice..." activeTab="board">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-12 text-center text-sm rounded-sm">
          Loading notice details...
        </div>
      </PageShell>
    );
  }

  if (!notice) {
    return (
      <PageShell title="Notice Not Found" activeTab="board">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-8 text-center space-y-4 rounded-sm">
          <p className="font-bold text-base">Notice #{noticeId.toString()} does not exist</p>
          <Link href="/">
            <Button variant="secondary" size="sm">Back to Board</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const isAuthor = address?.toLowerCase() === notice.author.toLowerCase();
  const timeInfo = timeLeft(notice.expiresAt, nowSecs);
  const topicName = TOPIC_NAMES[notice.topic as keyof typeof TOPIC_NAMES];

  return (
    <PageShell
      title={`Notice #${notice.id.toString()}`}
      subtitle={`Category: ${topicName} · Author: ${notice.author}`}
      activeTab="board"
      badge={
        isAuthor ? (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-[var(--accent)] text-[var(--accent-ink)] rounded">
            Your Notice
          </span>
        ) : undefined
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {error && (
          <div className="p-3 bg-[#FDF0ED] border border-[var(--danger)] text-[var(--danger)] text-xs font-semibold rounded-sm">
            {error}
          </div>
        )}

        {/* Note Card Display */}
        <div className="max-w-md mx-auto">
          <NoteCard
            notice={notice}
            nowSecs={nowSecs}
            userAddress={address}
            onSweep={handleSweep}
            onUnpin={handleUnpin}
            sweeping={sweeping}
            unpinning={unpinning}
          />
        </div>

        {/* Author Controls Panel */}
        {isAuthor && notice.open && (
          <Panel heading="Author Actions">
            <div className="space-y-4">
              <form onSubmit={handleRenew} className="space-y-3 pb-4 border-b border-[var(--border-subtle)]">
                <label htmlFor="renewHrs" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Renew Expiry (Free)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="renewHrs"
                    type="number"
                    step="any"
                    min="1"
                    max="720"
                    value={renewHours}
                    onChange={(e) => setRenewHours(e.target.value)}
                    className="w-24 px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-sm"
                  />
                  <span className="text-xs text-[var(--text-muted)]">hours from now</span>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={renewing}
                    disabled={renewing}
                  >
                    Renew Notice
                  </Button>
                </div>
              </form>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold">Take Down Notice</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Takes the note off the board and refunds 100% of your deposit ({formatEther(notice.deposit)} BOT).
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  loading={unpinning}
                  disabled={unpinning}
                  onClick={handleUnpin}
                >
                  Take Down
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Notice Meta Details */}
        <Panel heading="On-Chain Details">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Status:</span>
              <div className="font-semibold">{notice.open ? (timeInfo.expired ? "Expired (Sweepable)" : "Open") : "Closed"}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Locked Deposit:</span>
              <div className="font-mono font-semibold">{formatEther(notice.deposit)} BOT</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Expiry Timestamp:</span>
              <div>{new Date(Number(notice.expiresAt) * 1000).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Posted At Block:</span>
              <div className="font-mono">{notice.postedBlock}</div>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
