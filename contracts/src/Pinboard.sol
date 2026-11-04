// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Pinboard — A deposit-backed public notice board with sweeping bounty
/// @notice Pin a notice with a deposit. Take it down to get it back.
contract Pinboard {
  // --- Constants ---
  uint256 public constant MAX_TEXT_BYTES = 200;
  uint8 public constant TOPICS = 8;
  uint64 public constant MIN_TTL = 1 hours;
  uint64 public constant MAX_TTL = 30 days;
  uint128 public constant MIN_DEPOSIT = 0.01 ether;
  uint128 public constant MAX_DEPOSIT = 100 ether;
  uint256 public constant SWEEP_BPS = 2000; // 20%
  uint256 public constant MAX_PAGE = 50;
  uint256 public constant MAX_SWEEP_SCAN = 200;

  // --- Structs ---
  struct Notice {
    address author;
    uint64 expiresAt;
    uint128 deposit;
    uint32 postedBlock;
    uint8 topic;
    bool open;
  }

  // --- State ---
  mapping(uint256 => Notice) private _notices;
  mapping(address => uint256) public pending;
  uint256 public noticeCount;
  uint256 public openCount;

  uint256 private _locked;

  // --- Events ---
  event Pinned(
    uint256 indexed id,
    address indexed author,
    uint8 indexed topic,
    uint64 expiresAt,
    uint128 deposit,
    string text
  );
  event Renewed(uint256 indexed id, uint64 expiresAt);
  event Unpinned(uint256 indexed id, address indexed author, uint256 refunded);
  event Swept(uint256 indexed id, address indexed by, uint256 bounty, uint256 returned);
  event Withdrawn(address indexed to, uint256 amount);

  // --- Errors ---
  error BadTopic();
  error EmptyText();
  error TextTooLong(uint256 len, uint256 max);
  error BadTtl();
  error BadDeposit(uint256 min, uint256 max);
  error NoticeNotFound();
  error NoticeNotOpen();
  error NotAuthor();
  error NotExpired(uint64 expiresAt);
  error NothingToWithdraw();
  error TransferFailed();
  error ReentrancyGuard();

  // --- Modifiers ---
  modifier nonReentrant() {
    if (_locked == 1) revert ReentrancyGuard();
    _locked = 1;
    _;
    _locked = 0;
  }

  // --- Core Functions ---

  /// @notice Pin a new notice to the board with a deposit
  function pin(uint8 topic, string calldata text, uint64 ttl) external payable returns (uint256 id) {
    if (topic >= TOPICS) revert BadTopic();
    uint256 textLen = bytes(text).length;
    if (textLen == 0) revert EmptyText();
    if (textLen > MAX_TEXT_BYTES) revert TextTooLong(textLen, MAX_TEXT_BYTES);
    if (ttl < MIN_TTL || ttl > MAX_TTL) revert BadTtl();
    if (msg.value < MIN_DEPOSIT || msg.value > MAX_DEPOSIT) {
      revert BadDeposit(MIN_DEPOSIT, MAX_DEPOSIT);
    }

    id = ++noticeCount;
    openCount++;

    uint64 expiresAt = uint64(block.timestamp + ttl);
    Notice storage n = _notices[id];
    n.author = msg.sender;
    n.expiresAt = expiresAt;
    n.deposit = uint128(msg.value);
    n.postedBlock = uint32(block.number);
    n.topic = topic;
    n.open = true;

    emit Pinned(id, msg.sender, topic, expiresAt, uint128(msg.value), text);
  }

  /// @notice Renew an active notice's expiry
  function renew(uint256 id, uint64 ttl) external {
    if (id == 0 || id > noticeCount) revert NoticeNotFound();
    Notice storage n = _notices[id];
    if (!n.open) revert NoticeNotOpen();
    if (msg.sender != n.author) revert NotAuthor();
    if (ttl < MIN_TTL || ttl > MAX_TTL) revert BadTtl();

    uint64 newExpiresAt = uint64(block.timestamp + ttl);
    n.expiresAt = newExpiresAt;

    emit Renewed(id, newExpiresAt);
  }

  /// @notice Author takes down notice, recovering entire deposit
  function unpin(uint256 id) external nonReentrant {
    if (id == 0 || id > noticeCount) revert NoticeNotFound();
    Notice storage n = _notices[id];
    if (!n.open) revert NoticeNotOpen();
    if (msg.sender != n.author) revert NotAuthor();

    n.open = false;
    openCount--;
    uint256 deposit = n.deposit;

    (bool ok, ) = msg.sender.call{value: deposit}("");
    if (!ok) revert TransferFailed();

    emit Unpinned(id, msg.sender, deposit);
  }

  /// @notice Anyone sweeps an expired notice to earn 20% bounty
  function sweep(uint256 id) external {
    if (id == 0 || id > noticeCount) revert NoticeNotFound();
    Notice storage n = _notices[id];
    if (!n.open) revert NoticeNotOpen();
    if (block.timestamp < n.expiresAt) revert NotExpired(n.expiresAt);

    n.open = false;
    openCount--;

    uint256 deposit = n.deposit;
    uint256 bounty = (deposit * SWEEP_BPS) / 10000;
    uint256 returned = deposit - bounty;

    pending[msg.sender] += bounty;
    pending[n.author] += returned;

    emit Swept(id, msg.sender, bounty, returned);
  }

  /// @notice Pull payment for accumulated balances
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // --- Views ---

  /// @notice Get notice details
  function noticeOf(uint256 id) external view returns (Notice memory) {
    if (id == 0 || id > noticeCount) revert NoticeNotFound();
    return _notices[id];
  }

  /// @notice Latest notices (newest first)
  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Notice[] memory notices, uint256 total)
  {
    total = noticeCount;
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Notice[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    notices = new Notice[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 id = total - (offset + i);
      ids[i] = id;
      notices[i] = _notices[id];
    }
  }

  /// @notice Notices posted by an author
  function byAuthor(address author, uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Notice[] memory notices, uint256 total)
  {
    // First count matches
    uint256 totalMatches = 0;
    for (uint256 i = noticeCount; i >= 1; i--) {
      if (_notices[i].author == author) {
        totalMatches++;
      }
    }
    total = totalMatches;

    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Notice[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    notices = new Notice[](count);

    uint256 matchIdx = 0;
    uint256 collected = 0;

    for (uint256 i = noticeCount; i >= 1 && collected < count; i--) {
      if (_notices[i].author == author) {
        if (matchIdx >= offset) {
          ids[collected] = i;
          notices[collected] = _notices[i];
          collected++;
        }
        matchIdx++;
      }
    }
  }

  /// @notice List open, expired notices eligible for sweep (scans up to 200 newest notices)
  function sweepable(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, uint256 total)
  {
    uint256 scanLimit = noticeCount > MAX_SWEEP_SCAN ? MAX_SWEEP_SCAN : noticeCount;
    uint256 startId = noticeCount;

    // Temporary memory buffer
    uint256[] memory temp = new uint256[](scanLimit);
    uint256 matchCount = 0;

    for (uint256 i = 0; i < scanLimit; i++) {
      uint256 id = startId - i;
      Notice storage n = _notices[id];
      if (n.open && block.timestamp >= n.expiresAt) {
        temp[matchCount++] = id;
      }
    }

    total = matchCount;
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    for (uint256 i = 0; i < count; i++) {
      ids[i] = temp[offset + i];
    }
  }
}
