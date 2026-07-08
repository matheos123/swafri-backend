import { ethers } from "hardhat";

/**
 * Deployment entrypoint.
 * Add contract deployment logic here once Solidity contracts are implemented.
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("No contracts configured yet. Add deployment logic in scripts/deploy.ts.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
