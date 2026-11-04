// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Pinboard} from "../src/Pinboard.sol";

contract MaliciousUnpinner {
  Pinboard public pinboard;
  constructor(Pinboard _pb) {
    pinboard = _pb;
  }
  function attackPin(uint8 topic, string calldata text, uint64 ttl) external payable returns (uint256) {
    return pinboard.pin{value: msg.value}(topic, text, ttl);
  }
  function attackUnpin(uint256 id) external {
    pinboard.unpin(id);
  }
  receive() external payable {
    // Attempt reentrant unpin
    pinboard.unpin(1);
  }
}

contract MaliciousWithdrawer {
  Pinboard public pinboard;
  constructor(Pinboard _pb) {
    pinboard = _pb;
  }
  function attackWithdraw() external {
    pinboard.withdraw();
  }
  receive() external payable {
    pinboard.withdraw();
  }
}

contract PinboardTest is Test {
  Pinboard public pb;
  address public alice = address(0x1111);
  address public bob = address(0x2222);
  address public charlie = address(0x3333);

  uint128 public constant DEPOSIT = 1 ether;
  uint64 public constant TTL = 1 days;

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

  function setUp() public {
    pb = new Pinboard();
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(charlie, 100 ether);
  }

  function test_PinStoresDepositAndBlock() public {
    vm.roll(42);
    vm.warp(1_000_000);

    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Bicycle for sale, mint condition", TTL);

    assertEq(id, 1);
    assertEq(pb.noticeCount(), 1);
    assertEq(pb.openCount(), 1);

    Pinboard.Notice memory n = pb.noticeOf(id);
    assertEq(n.author, alice);
    assertEq(n.expiresAt, 1_000_000 + TTL);
    assertEq(n.deposit, DEPOSIT);
    assertEq(n.postedBlock, 42);
    assertEq(n.topic, 0);
    assertTrue(n.open);
  }

  function test_PinEmitsText() public {
    vm.warp(1_000_000);
    string memory text = "Lost orange cat near Elm St";

    vm.expectEmit(true, true, true, true);
    emit Pinned(1, alice, 3, 1_000_000 + TTL, DEPOSIT, text);

    vm.prank(alice);
    pb.pin{value: DEPOSIT}(3, text, TTL);
  }

  function test_BadTopicTextTtlDepositRevert() public {
    // Bad topic (>= 8)
    vm.expectRevert(Pinboard.BadTopic.selector);
    pb.pin{value: DEPOSIT}(8, "Valid text", TTL);

    // Empty text
    vm.expectRevert(Pinboard.EmptyText.selector);
    pb.pin{value: DEPOSIT}(0, "", TTL);

    // Text too long (> 200 bytes)
    string memory longText = new string(201);
    vm.expectRevert(abi.encodeWithSelector(Pinboard.TextTooLong.selector, 201, 200));
    pb.pin{value: DEPOSIT}(0, longText, TTL);

    // TTL too short (< 1 hours)
    vm.expectRevert(Pinboard.BadTtl.selector);
    pb.pin{value: DEPOSIT}(0, "Valid text", 59 minutes);

    // TTL too long (> 30 days)
    vm.expectRevert(Pinboard.BadTtl.selector);
    pb.pin{value: DEPOSIT}(0, "Valid text", 31 days);

    // Deposit too low (< 0.01 ether)
    vm.expectRevert(abi.encodeWithSelector(Pinboard.BadDeposit.selector, 0.01 ether, 100 ether));
    pb.pin{value: 0.009 ether}(0, "Valid text", TTL);

    // Deposit too high (> 100 ether)
    vm.deal(alice, 200 ether);
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Pinboard.BadDeposit.selector, 0.01 ether, 100 ether));
    pb.pin{value: 101 ether}(0, "Valid text", TTL);
  }

  function test_UnpinReturnsFullDeposit() public {
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Notice text", TTL);

    uint256 balBefore = alice.balance;

    vm.prank(alice);
    pb.unpin(id);

    assertEq(alice.balance, balBefore + DEPOSIT);
    assertEq(pb.openCount(), 0);

    Pinboard.Notice memory n = pb.noticeOf(id);
    assertFalse(n.open);
  }

  function test_UnpinAfterExpiryBeforeSweepStillRefundsAll() public {
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Notice text", TTL);

    // Warp past expiry
    vm.warp(block.timestamp + TTL + 100);

    // Not yet swept: author can still unpin for 100% refund
    uint256 balBefore = alice.balance;
    vm.prank(alice);
    pb.unpin(id);

    assertEq(alice.balance, balBefore + DEPOSIT);
    assertFalse(pb.noticeOf(id).open);
  }

  function test_SweepBeforeExpiryReverts_ArgsExpiresAt() public {
    vm.warp(1_000_000);
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Notice text", TTL);

    uint64 expiresAt = 1_000_000 + TTL;

    vm.prank(bob);
    vm.expectRevert(abi.encodeWithSelector(Pinboard.NotExpired.selector, expiresAt));
    pb.sweep(id);
  }

  function test_SweepSplitsBountyAndRemainder() public {
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Notice text", TTL);

    // Warp past expiry
    vm.warp(block.timestamp + TTL + 1);

    // Bob sweeps
    vm.prank(bob);
    pb.sweep(id);

    // Bounty: 20% of 1 ether = 0.2 ether
    // Remainder: 80% of 1 ether = 0.8 ether
    assertEq(pb.pending(bob), 0.2 ether);
    assertEq(pb.pending(alice), 0.8 ether);
    assertEq(pb.openCount(), 0);
    assertFalse(pb.noticeOf(id).open);

    // Bob withdraws
    uint256 bobBal = bob.balance;
    vm.prank(bob);
    pb.withdraw();
    assertEq(bob.balance, bobBal + 0.2 ether);

    // Alice withdraws
    uint256 aliceBal = alice.balance;
    vm.prank(alice);
    pb.withdraw();
    assertEq(alice.balance, aliceBal + 0.8 ether);
  }

  function test_SweepRounding() public {
    // Odd deposit: 0.010000000000000003 ether
    uint128 oddDeposit = 0.01 ether + 3 wei;
    vm.prank(alice);
    uint256 id = pb.pin{value: oddDeposit}(0, "Odd deposit text", TTL);

    vm.warp(block.timestamp + TTL + 1);

    vm.prank(bob);
    pb.sweep(id);

    uint256 bounty = (uint256(oddDeposit) * 2000) / 10000;
    uint256 returned = uint256(oddDeposit) - bounty;

    assertEq(pb.pending(bob), bounty);
    assertEq(pb.pending(alice), returned);
    assertEq(bounty + returned, oddDeposit);
  }

  function test_RenewMovesExpiry_NotAuthorReverts() public {
    vm.warp(1_000_000);
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Event notice", TTL);

    // Stranger tries to renew -> revert
    vm.prank(bob);
    vm.expectRevert(Pinboard.NotAuthor.selector);
    pb.renew(id, 2 days);

    // Alice renews for 2 days
    vm.prank(alice);
    pb.renew(id, 2 days);

    Pinboard.Notice memory n = pb.noticeOf(id);
    assertEq(n.expiresAt, 1_000_000 + 2 days);
  }

  function test_CannotSweepOrUnpinTwice() public {
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Notice", TTL);

    vm.prank(alice);
    pb.unpin(id);

    // Try unpin again
    vm.prank(alice);
    vm.expectRevert(Pinboard.NoticeNotOpen.selector);
    pb.unpin(id);

    // Try sweep
    vm.warp(block.timestamp + TTL + 10);
    vm.prank(bob);
    vm.expectRevert(Pinboard.NoticeNotOpen.selector);
    pb.sweep(id);
  }

  function test_OpenCountTracks() public {
    assertEq(pb.openCount(), 0);

    vm.prank(alice);
    uint256 id1 = pb.pin{value: DEPOSIT}(0, "Notice 1", TTL);
    assertEq(pb.openCount(), 1);

    vm.prank(bob);
    uint256 id2 = pb.pin{value: DEPOSIT}(1, "Notice 2", TTL);
    assertEq(pb.openCount(), 2);

    vm.prank(alice);
    pb.unpin(id1);
    assertEq(pb.openCount(), 1);

    vm.warp(block.timestamp + TTL + 1);
    vm.prank(charlie);
    pb.sweep(id2);
    assertEq(pb.openCount(), 0);
  }

  function test_SweepableListsOnlyExpired() public {
    vm.warp(1_000_000);
    vm.prank(alice);
    uint256 id1 = pb.pin{value: DEPOSIT}(0, "Active", 10 days);

    vm.prank(bob);
    uint256 id2 = pb.pin{value: DEPOSIT}(1, "Expired", 1 days);

    // At 1_000_000 + 2 days, id2 is expired, id1 is not
    vm.warp(1_000_000 + 2 days);

    (uint256[] memory sweepableIds, uint256 total) = pb.sweepable(0, 10);
    assertEq(total, 1);
    assertEq(sweepableIds.length, 1);
    assertEq(sweepableIds[0], id2);
  }

  function test_ReentrantUnpinBlocked() public {
    MaliciousUnpinner mal = new MaliciousUnpinner(pb);
    vm.deal(address(mal), 10 ether);

    uint256 id = mal.attackPin{value: DEPOSIT}(0, "Attack", TTL);

    vm.expectRevert(Pinboard.TransferFailed.selector);
    mal.attackUnpin(id);
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousWithdrawer mal = new MaliciousWithdrawer(pb);
    vm.deal(alice, 10 ether);

    // Alice pins notice
    vm.prank(alice);
    uint256 id = pb.pin{value: DEPOSIT}(0, "Sweep me", TTL);

    vm.warp(block.timestamp + TTL + 1);

    // mal sweeps notice to get pending bounty
    vm.prank(address(mal));
    pb.sweep(id);

    assertEq(pb.pending(address(mal)), 0.2 ether);

    // mal attempts reentrant withdraw
    vm.expectRevert(Pinboard.TransferFailed.selector);
    mal.attackWithdraw();
  }

  function test_BoundaryMutantKillers() public {
    // Exactly 200 bytes
    string memory text200 = new string(200);
    pb.pin{value: DEPOSIT}(7, text200, TTL);

    // MIN_TTL and MAX_TTL
    pb.pin{value: DEPOSIT}(0, "Min TTL", pb.MIN_TTL());
    pb.pin{value: DEPOSIT}(0, "Max TTL", pb.MAX_TTL());

    // MIN_DEPOSIT and MAX_DEPOSIT
    pb.pin{value: pb.MIN_DEPOSIT()}(0, "Min Dep", TTL);
    pb.pin{value: pb.MAX_DEPOSIT()}(0, "Max Dep", TTL);

    // Withdraw with 0 pending
    vm.expectRevert(Pinboard.NothingToWithdraw.selector);
    pb.withdraw();

    // Latest pagination
    (uint256[] memory ids, , uint256 total) = pb.latest(0, 10);
    assertEq(total, pb.noticeCount());
    assertTrue(ids.length > 0);

    // byAuthor pagination
    (uint256[] memory aIds, , uint256 aTotal) = pb.byAuthor(address(this), 0, 10);
    assertTrue(aTotal > 0);
    assertTrue(aIds.length > 0);
  }

  function testFuzz_Conservation(uint8 tCount, uint32[5] memory ttlWarps) public {
    tCount = uint8(bound(tCount, 1, 4));

    for (uint256 i = 0; i < tCount; i++) {
      address user = address(uint160(0x5000 + i));
      vm.deal(user, 10 ether);
      vm.prank(user);
      pb.pin{value: DEPOSIT}(uint8(i % 8), "Fuzz text", TTL);
    }

    // Warp and perform some sweeps or unpins
    vm.warp(block.timestamp + TTL + 1);

    for (uint256 i = 1; i <= tCount; i++) {
      if (i % 2 == 0) {
        address author = pb.noticeOf(i).author;
        vm.prank(author);
        pb.unpin(i);
      } else {
        vm.prank(charlie);
        pb.sweep(i);
      }
    }

    // Sum open deposits + sum pending == balance
    uint256 openSum = 0;
    for (uint256 i = 1; i <= pb.noticeCount(); i++) {
      Pinboard.Notice memory n = pb.noticeOf(i);
      if (n.open) {
        openSum += n.deposit;
      }
    }

    uint256 pendingSum = 0;
    for (uint256 i = 0; i < tCount; i++) {
      pendingSum += pb.pending(address(uint160(0x5000 + i)));
    }
    pendingSum += pb.pending(charlie);

    assertEq(address(pb).balance, openSum + pendingSum);
  }
}
