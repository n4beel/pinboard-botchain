// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Pinboard} from "../src/Pinboard.sol";

contract PinboardHandler is Test {
  Pinboard public pb;
  address[] public users;
  uint256 public sumOpenDeposits;
  uint256 public sumPending;

  constructor(Pinboard _pb) {
    pb = _pb;
    users.push(address(0x1111));
    users.push(address(0x2222));
    users.push(address(0x3333));

    for (uint256 i = 0; i < users.length; i++) {
      vm.deal(users[i], 1_000 ether);
    }
  }

  function pin(uint8 uIdx, uint8 topic, uint128 deposit, uint64 ttl) external {
    address u = users[uIdx % users.length];
    topic = uint8(bound(topic, 0, 7));
    deposit = uint128(bound(deposit, pb.MIN_DEPOSIT(), 5 ether));
    ttl = uint64(bound(ttl, pb.MIN_TTL(), pb.MAX_TTL()));

    vm.prank(u);
    try pb.pin{value: deposit}(topic, "Invariant note", ttl) returns (uint256) {
      sumOpenDeposits += deposit;
    } catch {}
  }

  function unpin(uint256 id) external {
    uint256 count = pb.noticeCount();
    if (count == 0) return;
    id = (id % count) + 1;

    Pinboard.Notice memory n = pb.noticeOf(id);
    if (n.open) {
      vm.prank(n.author);
      try pb.unpin(id) {
        sumOpenDeposits -= n.deposit;
      } catch {}
    }
  }

  function sweep(uint8 uIdx, uint256 id) external {
    uint256 count = pb.noticeCount();
    if (count == 0) return;
    id = (id % count) + 1;
    address sweeper = users[uIdx % users.length];

    Pinboard.Notice memory n = pb.noticeOf(id);
    if (n.open && block.timestamp >= n.expiresAt) {
      vm.prank(sweeper);
      try pb.sweep(id) {
        sumOpenDeposits -= n.deposit;
        sumPending += n.deposit;
      } catch {}
    }
  }

  function withdraw(uint8 uIdx) external {
    address u = users[uIdx % users.length];
    uint256 p = pb.pending(u);
    if (p > 0) {
      vm.prank(u);
      try pb.withdraw() {
        sumPending -= p;
      } catch {}
    }
  }

  function warp(uint32 secs) external {
    secs = uint32(bound(secs, 1 hours, 5 days));
    vm.warp(block.timestamp + secs);
  }
}

contract PinboardInvariantTest is Test {
  Pinboard public pb;
  PinboardHandler public handler;

  function setUp() public {
    pb = new Pinboard();
    handler = new PinboardHandler(pb);
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsOpenPlusPending() public view {
    assertEq(address(pb).balance, handler.sumOpenDeposits() + handler.sumPending());
  }
}
