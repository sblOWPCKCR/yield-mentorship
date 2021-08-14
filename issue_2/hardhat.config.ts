import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";


import "hardhat-preprocessor";
import "hardhat-gas-reporter";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/clean";
import "./tasks/deployers";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
};

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const etherscanKey: string | undefined = process.env.ETHERSCAN_KEY;
if (!etherscanKey) {
  throw new Error("Please set your ETHERSCAN_KEY in a .env file");
}

const needsPreprocessing = (process.env.YARN_PREPROCESS == "1");
const needsSmtChecker = (process.env.SMT_CHECKER == "1")
const contractsDir = needsPreprocessing || needsSmtChecker ? "./contracts" : "./.processed";

function getChainConfig(network: keyof typeof chainIds): NetworkUserConfig {
  const url: string = "https://" + network + ".infura.io/v3/" + infuraApiKey;
  return {
    accounts: {
      count: 10,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: contractsDir,
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      // See https://github.com/sc-forks/solidity-coverage/issues/652
      hardfork: process.env.CODE_COVERAGE ? "berlin" : "london",
    },
    goerli: getChainConfig("goerli"),
    kovan: getChainConfig("kovan"),
    rinkeby: getChainConfig("rinkeby"),
    ropsten: getChainConfig("ropsten"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: contractsDir,
    tests: "./test",
  },
  solidity: {
    version: "0.8.7",
    settings: {
      modelChecker: {
        engine: needsSmtChecker ? "chc" : "none",
        showUnproved: true,
        timeout: 0,
        contracts: {
          "contracts/BadVault.sol": ["BadVault"]
        }
      },
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: etherscanKey
  },
  preprocess: {
    eachLine: (hre) => ({
      transform: needsSmtChecker
        ? (line) => line // don't remote #nonprod code when SMTChecker is requested
        : (line) => {
          if (line.trimEnd().endsWith("#noprod")) {
            return "// " + line;
          }
          return line;
        },
      settings: { comment: true } // ensure the cache is working, in that example it can be anything as there is no option, the preprocessing happen all the time
    })
  },
};

export default config;
