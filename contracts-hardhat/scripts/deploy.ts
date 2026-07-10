import hre from "hardhat";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: "../.env" });

const __dirname = dirname(fileURLToPath(import.meta.url));

async function deploy(
  provider: ethers.JsonRpcProvider,
  wallet: ethers.Wallet,
  artifactName: string,
  constructorArgs: unknown[] = [],
): Promise<string> {
  // Read artifact from Hardhat's compiled output
  const artifactPath = join(
    __dirname,
    `../artifacts/contracts/${artifactName}.sol/${artifactName}.json`,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ ${artifactName} deployed to: ${address}`);
  return address;
}

async function main() {
  const rpcUrl     = process.env.BLOCKCHAIN_RPC_URL ?? "https://sepolia.base.org";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`\nDeployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log(`Network:  Base Sepolia (${rpcUrl})\n`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has no ETH. Get test ETH from a faucet first.");
  }

  const playerProfileAddress   = await deploy(provider, wallet, "PlayerProfile");
  const matchRegistryAddress   = await deploy(provider, wallet, "MatchRegistry");
  const achievementBadgeAddress = await deploy(provider, wallet, "AchievementBadge");

  console.log("\n--- Copy these into your .env and Render env vars ---");
  console.log(`PLAYER_PROFILE_ADDRESS=${playerProfileAddress}`);
  console.log(`BATTLE_ARENA_ADDRESS=${matchRegistryAddress}`);
  console.log(`ACHIEVEMENT_NFT_ADDRESS=${achievementBadgeAddress}`);
  console.log("-----------------------------------------------------\n");
}

main().catch((e) => {
  console.error("Deployment failed:", e);
  process.exit(1);
});
