"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { useWriteContract } from "@/lib/useChainWrite";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import Corkboard from "@/components/corkboard/Corkboard";
import { PINBOARD_ABI } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import { PINNED_EVENT } from "@/lib/logs";
import { NoticeInfo } from "@/lib/pinboard";
import { humanizePinboardError } from "@/lib/errors";

export default function BoardHomePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { writeContractAsync } = useWriteContract();
  const chainId = activeBotChain.id;
  const deployed = isDeployed(chainId);
  const contractAddress = deployed ? getDeployment(chainId).address : undefined;

  const [notices, setNotices] = useState<NoticeInfo[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  const [nowSecs, setNowSecs] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [loading, setLoading] = useState(true);
  const [sweepingId, setSweepingId] = useState<bigint | null>(null);
  const [unpinningId, setUnpinningId] = useState<bigint | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      if (!publicClient || !contractAddress) {
        setLoading(false);
        return;
      }

      try {
        const block = await publicClient.getBlock();
        if (!cancelled) setNowSecs(block.timestamp);

        const totalNotices = (await publicClient.readContract({
          address: contractAddress,
          abi: PINBOARD_ABI,
          functionName: "noticeCount",
        })) as bigint;

        if (totalNotices === 0n) {
          if (!cancelled) {
            setNotices([]);
            setLoading(false);
          }
          return;
        }

        const countToFetch = totalNotices > 50n ? 50n : totalNotices;
        const res = (await publicClient.readContract({
          address: contractAddress,
          abi: PINBOARD_ABI,
          functionName: "latest",
          args: [0n, countToFetch],
        })) as [readonly bigint[], readonly any[], bigint];

        const [ids, noticeData] = res;
        const list: NoticeInfo[] = [];

        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const raw = noticeData[i];
          const postedBlock = Number(raw.postedBlock);

          // Read text from Pinned log at postedBlock (§4)
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
          } catch {
            // Keep "text unavailable"
          }

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
          setNotices(list);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load pinboard:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadBoard();
    const interval = setInterval(loadBoard, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainId, contractAddress]);

  // Sweep Handler
  async function handleSweep(id: bigint) {
    if (!publicClient || !contractAddress) return;
    setActionError(null);
    setSweepingId(id);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "sweep",
        args: [id],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Optimistically close notice
      setNotices((prev) =>
        prev.map((n) => (n.id === id ? { ...n, open: false } : n))
      );
    } catch (err: any) {
      console.error(err);
      setActionError(humanizePinboardError(err));
    } finally {
      setSweepingId(null);
    }
  }

  // Unpin Handler
  async function handleUnpin(id: bigint) {
    if (!publicClient || !contractAddress) return;
    setActionError(null);
    setUnpinningId(id);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PINBOARD_ABI,
        functionName: "unpin",
        args: [id],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Optimistically close notice
      setNotices((prev) =>
        prev.map((n) => (n.id === id ? { ...n, open: false } : n))
      );
    } catch (err: any) {
      console.error(err);
      setActionError(humanizePinboardError(err));
    } finally {
      setUnpinningId(null);
    }
  }

  return (
    <PageShell
      title="The Public Corkboard"
      subtitle="Pin a notice with a deposit. Take it down to get it back, or sweep expired notices for a 20% bounty."
      activeTab="board"
      action={
        <Link href="/pin">
          <Button variant="primary" size="md">
            + Pin a Notice
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {actionError && (
          <div className="p-3 bg-[#FDF0ED] border-2 border-[var(--danger)] text-[var(--danger)] text-xs font-semibold rounded-sm">
            {actionError}
          </div>
        )}

        {/* What goes on the board (§3.4) */}
        <section aria-labelledby="limits-heading" className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 rounded-sm shadow-xs">
          <h2 id="limits-heading" className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-sans mb-1.5">
            What goes on the board
          </h2>
          <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc list-inside">
            <li><strong>The text is public and permanent in the chain's log.</strong></li>
            <li><strong>Nobody moderates.</strong> A notice stays until it expires or its author takes it down.</li>
            <li><strong>Forget one and a sweeper keeps 20% of the deposit.</strong></li>
          </ul>
        </section>

        {!contractAddress ? (
          <div className="bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-default)] p-8 text-center rounded-sm">
            <p className="font-bold text-base">Pinboard contract not deployed on this network</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Please connect to BOT Chain or local testnet.</p>
          </div>
        ) : loading && notices.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-12 text-center text-sm rounded-sm">
            Loading the corkboard...
          </div>
        ) : (
          <Corkboard
            notices={notices}
            nowSecs={nowSecs}
            userAddress={address}
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
            onSweep={handleSweep}
            onUnpin={handleUnpin}
            sweepingId={sweepingId}
            unpinningId={unpinningId}
          />
        )}
      </div>
    </PageShell>
  );
}
