import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim() ?? "";
const accounts = PRIVATE_KEY.length > 0 ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygonAmoy: {
      url:
        process.env.POLYGON_AMOY_RPC?.trim() ||
        process.env.RPC_URL?.trim() ||
        "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL?.trim() || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY?.trim() ?? "",
      sepolia: process.env.ETHERSCAN_API_KEY?.trim() ?? process.env.POLYGONSCAN_API_KEY?.trim() ?? "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    ignition: "./ignition",
  },
};

export default config;
