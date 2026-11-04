import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { NoticeInfo, TOPIC_NAMES, timeLeft, noteAngle, bounty } from "@/lib/pinboard";

export interface NoteCardProps {
  notice: NoticeInfo;
  nowSecs: bigint;
  userAddress?: string;
  onSweep?: (id: bigint) => void;
  onUnpin?: (id: bigint) => void;
  sweeping?: boolean;
  unpinning?: boolean;
}

export function NoteCard({
  notice,
  nowSecs,
  userAddress,
  onSweep,
  onUnpin,
  sweeping = false,
  unpinning = false,
}: NoteCardProps) {
  const isAuthor = userAddress?.toLowerCase() === notice.author.toLowerCase();
  const timeInfo = timeLeft(notice.expiresAt, nowSecs);
  const angle = noteAngle(notice.id);
  const topicName = (TOPIC_NAMES[notice.topic as number] as string) || "Notice";
  const bountyAmount = bounty(notice.deposit);

  // Pin colors by topic
  const pinColor = [
    "#D90429", // 0 For sale (red)
    "#2B9348", // 1 Wanted (green)
    "#0077B6", // 2 Event (blue)
    "#E85D04", // 3 Lost & found (orange)
    "#7209B7", // 4 Offer (purple)
    "#3A0CA3", // 5 Notice (indigo)
    "#0096C7", // 6 Jobs (cyan)
    "#555555", // 7 Other (grey)
  ][notice.topic % 8];

  return (
    <article
      style={{ transform: `rotate(${angle}deg)` }}
      aria-label={`Notice #${notice.id.toString()}: ${topicName}`}
      className={`pin-note p-4 flex flex-col justify-between min-h-[220px] rounded-sm ${
        timeInfo.expired && notice.open
          ? "border-2 border-[var(--warning)] bg-[#FFFDF5]"
          : !notice.open
          ? "opacity-60 bg-[#F5EDF0]"
          : ""
      }`}
    >
      {/* Visual Top Pin */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full inline-block shadow-xs border border-black/20"
            style={{ backgroundColor: pinColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-bold uppercase tracking-wider font-sans text-[var(--text-secondary)]">
            {topicName}
          </span>
        </div>

        {/* Notice ID and status */}
        <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium">
          <Link
            href={`/notice/${notice.id.toString()}`}
            className="hover:underline text-[var(--text-muted)]"
          >
            #{notice.id.toString()}
          </Link>
          {isAuthor && (
            <span className="px-1 py-0.2 bg-[var(--text-primary)] text-white text-[9px] uppercase font-bold rounded">
              YOU
            </span>
          )}
        </div>
      </div>

      {/* Main Handwriting Text & Plain Fallback (§3.1) */}
      <div className="my-2 flex-1">
        <p className="font-note text-[var(--text-primary)] whitespace-pre-wrap select-text">
          {notice.text || "text unavailable"}
        </p>
        <p className="font-sans text-[11px] text-[var(--text-muted)] mt-2 pt-1 border-t border-[var(--border-subtle)] line-clamp-2">
          {notice.text || "text unavailable"}
        </p>
      </div>

      {/* Notice Footer / Expiry / Sweep Stamp */}
      <div className="pt-2 border-t border-[var(--border-subtle)] font-sans text-xs">
        <div className="flex items-center justify-between gap-1 text-[var(--text-secondary)]">
          <span className="font-mono font-medium">{formatEther(notice.deposit)} BOT dep</span>
          <span>{notice.open ? timeInfo.text : "Archived"}</span>
        </div>

        {/* Expired & Sweepable Stamp (§3.1) */}
        {notice.open && timeInfo.expired && (
          <div className="mt-2 p-1.5 bg-[#FFF0DB] border border-[#8A5A00] text-[#8A5A00] text-[11px] font-bold rounded flex items-center justify-between">
            <span>Sweepable: earn {formatEther(bountyAmount)} BOT</span>
            {onSweep && (
              <button
                onClick={() => onSweep(notice.id)}
                disabled={sweeping}
                className="px-2 py-0.5 bg-[#8A5A00] text-white rounded text-[10px] uppercase font-bold hover:brightness-110 cursor-pointer disabled:opacity-50"
              >
                {sweeping ? "…" : "Sweep"}
              </button>
            )}
          </div>
        )}

        {/* Author Controls */}
        {notice.open && isAuthor && onUnpin && (
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={() => onUnpin(notice.id)}
              disabled={unpinning}
              className="text-[11px] text-[var(--danger)] hover:underline font-bold cursor-pointer disabled:opacity-50"
            >
              {unpinning ? "Taking down…" : "Take Down (100% Refund)"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default NoteCard;
