export function humanizePinboardError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("BadTopic")) {
    return "Invalid topic selection. Must be one of the 8 allowed categories.";
  }
  if (msg.includes("EmptyText")) {
    return "Notice text cannot be empty.";
  }
  if (msg.includes("TextTooLong")) {
    const match = msg.match(/len: (\d+).*max: (\d+)/i) || msg.match(/(\d+), (\d+)/);
    if (match) {
      return `${match[1]} bytes; the limit is ${match[2]}.`;
    }
    return "Text exceeds the maximum length of 200 bytes.";
  }
  if (msg.includes("BadTtl")) {
    return "Duration must be between 1 hour and 30 days.";
  }
  if (msg.includes("BadDeposit")) {
    return "Deposit must be between 0.01 BOT and 100 BOT.";
  }
  if (msg.includes("NoticeNotFound")) {
    return "Notice does not exist.";
  }
  if (msg.includes("NoticeNotOpen")) {
    return "This notice has already been taken down or swept.";
  }
  if (msg.includes("NotAuthor")) {
    return "Only the author can modify or take down this notice.";
  }
  if (msg.includes("NotExpired")) {
    const match = msg.match(/expiresAt: (\d+)/i);
    if (match) {
      const date = new Date(Number(match[1]) * 1000).toLocaleTimeString();
      return `This notice cannot be swept until expiry at ${date}.`;
    }
    return "This notice has not expired yet and cannot be swept.";
  }
  if (msg.includes("NothingToWithdraw")) {
    return "No pending funds available to withdraw.";
  }
  if (msg.includes("TransferFailed")) {
    return "BOT transfer failed.";
  }
  if (msg.includes("User rejected") || msg.includes("denied transaction signature")) {
    return "Transaction was cancelled in your wallet.";
  }

  return msg.slice(0, 160);
}
