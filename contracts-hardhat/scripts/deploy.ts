import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hre from "hardhat";

async function main() {
  // @ts-ignore — Hardhat 3 injects ethers via plugin at runtime
  const ethers = (hre as any).ethers;

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Deploy PlayerProfile
  const PlayerProfile = await ethers.getContractFactory("PlayerProfile");
  const playerProfile = await PlayerProfile.deploy();
  await playerProfile.waitForDeployment();
  const ppAddress = await playerProfile.getAddress();
  console.log("PlayerProfile deployed to:", ppAddress);

  // Deploy MatchRegistry
  const MatchRegistry = await ethers.getContractFactory("MatchRegistry");
  const matchRegistry = await MatchRegistry.deploy();
  await matchRegistry.waitForDeployment();
  const mrAddress = await matchRegistry.getAddress();
  console.log("MatchRegistry deployed to:", mrAddress);

  // Deploy AchievementBadge
  const AchievementBadge = await ethers.getContractFactory("AchievementBadge");
  const achievementBadge = await AchievementBadge.deploy();
  await achievementBadge.waitForDeployment();
  const abAddress = await achievementBadge.getAddress();
  console.log("AchievementBadge deployed to:", abAddress);

  console.log("\n--- Copy these into your .env ---");
  console.log(`PLAYER_PROFILE_ADDRESS=${ppAddress}`);
  console.log(`BATTLE_ARENA_ADDRESS=${mrAddress}`);
  console.log(`ACHIEVEMENT_NFT_ADDRESS=${abAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
