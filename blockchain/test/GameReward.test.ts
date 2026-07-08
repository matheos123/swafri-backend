import { expect } from "chai";
import { ethers } from "hardhat";
import { GameReward } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GameReward", function () {
  const MATCH_ID = 101n;
  const TIMESTAMP = 1_700_000_000n;
  const GAME_TYPE = "rps";
  const RESULT_HASH = ethers.id("match-result-101");
  const WIN_POINTS = 10n;

  const BADGE_NONE = 0;
  const BADGE_WATER = 1;
  const BADGE_FIRE = 2;
  const BADGE_GOLD = 3;

  let gameReward: GameReward;
  let owner: HardhatEthersSigner;
  let winner: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, winner, stranger] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("GameReward");
    gameReward = await factory.deploy(owner.address);
    await gameReward.waitForDeployment();
  });

  describe("deployment", function () {
    it("sets the backend wallet as owner", async function () {
      expect(await gameReward.owner()).to.equal(owner.address);
    });

    it("reverts when deployed with zero address owner", async function () {
      const factory = await ethers.getContractFactory("GameReward");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        factory,
        "OwnableInvalidOwner",
      );
    });
  });

  describe("recordMatch", function () {
    it("records match data and emits MatchRecorded", async function () {
      await expect(
        gameReward.recordMatch(
          MATCH_ID,
          winner.address,
          TIMESTAMP,
          GAME_TYPE,
          RESULT_HASH,
          WIN_POINTS,
          BADGE_WATER,
        ),
      )
        .to.emit(gameReward, "MatchRecorded")
        .withArgs(
          MATCH_ID,
          winner.address,
          TIMESTAMP,
          GAME_TYPE,
          RESULT_HASH,
          WIN_POINTS,
          BADGE_WATER,
        );

      expect(await gameReward.matchExists(MATCH_ID)).to.equal(true);

      const match = await gameReward.getMatch(MATCH_ID);
      expect(match.winner).to.equal(winner.address);
      expect(match.timestamp).to.equal(TIMESTAMP);
      expect(match.gameType).to.equal(GAME_TYPE);
      expect(match.resultHash).to.equal(RESULT_HASH);
      expect(match.pointsAwarded).to.equal(WIN_POINTS);
      expect(match.badgeEarned).to.equal(BADGE_WATER);
    });

    it("prevents duplicate match IDs", async function () {
      await gameReward.recordMatch(
        MATCH_ID,
        winner.address,
        TIMESTAMP,
        GAME_TYPE,
        RESULT_HASH,
        WIN_POINTS,
        BADGE_NONE,
      );

      await expect(
        gameReward.recordMatch(
          MATCH_ID,
          winner.address,
          TIMESTAMP,
          GAME_TYPE,
          RESULT_HASH,
          WIN_POINTS,
          BADGE_NONE,
        ),
      ).to.be.revertedWithCustomError(gameReward, "MatchAlreadyRecorded");
    });

    it("rejects invalid badge IDs in match records", async function () {
      await expect(
        gameReward.recordMatch(
          MATCH_ID,
          winner.address,
          TIMESTAMP,
          GAME_TYPE,
          RESULT_HASH,
          WIN_POINTS,
          6,
        ),
      ).to.be.revertedWithCustomError(gameReward, "InvalidBadgeId");
    });

    it("reverts when reading a missing match", async function () {
      await expect(gameReward.getMatch(999n)).to.be.revertedWithCustomError(
        gameReward,
        "MatchNotFound",
      );
    });

    it("blocks non-owner callers", async function () {
      await expect(
        gameReward.connect(stranger).recordMatch(
          MATCH_ID,
          winner.address,
          TIMESTAMP,
          GAME_TYPE,
          RESULT_HASH,
          WIN_POINTS,
          BADGE_NONE,
        ),
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });
  });

  describe("awardPoints", function () {
    it("awards and accumulates player points", async function () {
      await expect(gameReward.awardPoints(winner.address, WIN_POINTS))
        .to.emit(gameReward, "PointsAwarded")
        .withArgs(winner.address, WIN_POINTS, WIN_POINTS);

      expect(await gameReward.getPlayerPoints(winner.address)).to.equal(WIN_POINTS);

      await gameReward.awardPoints(winner.address, WIN_POINTS);
      expect(await gameReward.getPlayerPoints(winner.address)).to.equal(WIN_POINTS * 2n);
    });

    it("rejects zero address recipients", async function () {
      await expect(
        gameReward.awardPoints(ethers.ZeroAddress, WIN_POINTS),
      ).to.be.revertedWithCustomError(gameReward, "InvalidAddress");
    });

    it("blocks non-owner callers", async function () {
      await expect(
        gameReward.connect(stranger).awardPoints(winner.address, WIN_POINTS),
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });
  });

  describe("mintBadge", function () {
    it("mints a badge and emits BadgeAwarded", async function () {
      await expect(gameReward.mintBadge(winner.address, BADGE_FIRE))
        .to.emit(gameReward, "BadgeAwarded")
        .withArgs(winner.address, BADGE_FIRE);

      expect(await gameReward.hasBadge(winner.address, BADGE_FIRE)).to.equal(true);
      expect(await gameReward.getPlayerBadges(winner.address)).to.deep.equal([BADGE_FIRE]);
    });

    it("prevents duplicate badge minting", async function () {
      await gameReward.mintBadge(winner.address, BADGE_GOLD);

      await expect(
        gameReward.mintBadge(winner.address, BADGE_GOLD),
      ).to.be.revertedWithCustomError(gameReward, "BadgeAlreadyMinted");
    });

    it("rejects badge ID zero and unsupported badge IDs", async function () {
      await expect(
        gameReward.mintBadge(winner.address, BADGE_NONE),
      ).to.be.revertedWithCustomError(gameReward, "InvalidBadgeId");

      await expect(gameReward.mintBadge(winner.address, 6)).to.be.revertedWithCustomError(
        gameReward,
        "InvalidBadgeId",
      );
    });

    it("rejects zero address recipients", async function () {
      await expect(
        gameReward.mintBadge(ethers.ZeroAddress, BADGE_WATER),
      ).to.be.revertedWithCustomError(gameReward, "InvalidAddress");
    });

    it("returns multiple owned badges in ascending order", async function () {
      await gameReward.mintBadge(winner.address, BADGE_GOLD);
      await gameReward.mintBadge(winner.address, BADGE_WATER);
      await gameReward.mintBadge(winner.address, BADGE_FIRE);

      expect(await gameReward.getPlayerBadges(winner.address)).to.deep.equal([
        BADGE_WATER,
        BADGE_FIRE,
        BADGE_GOLD,
      ]);
    });

    it("blocks non-owner callers", async function () {
      await expect(
        gameReward.connect(stranger).mintBadge(winner.address, BADGE_WATER),
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });
  });

  describe("backend integration flow", function () {
    it("supports record -> award points -> mint badge workflow", async function () {
      await gameReward.recordMatch(
        MATCH_ID,
        winner.address,
        TIMESTAMP,
        GAME_TYPE,
        RESULT_HASH,
        WIN_POINTS,
        BADGE_WATER,
      );
      await gameReward.awardPoints(winner.address, WIN_POINTS);
      await gameReward.mintBadge(winner.address, BADGE_WATER);

      const match = await gameReward.getMatch(MATCH_ID);
      expect(match.pointsAwarded).to.equal(WIN_POINTS);
      expect(match.badgeEarned).to.equal(BADGE_WATER);
      expect(await gameReward.getPlayerPoints(winner.address)).to.equal(WIN_POINTS);
      expect(await gameReward.hasBadge(winner.address, BADGE_WATER)).to.equal(true);
    });
  });
});
