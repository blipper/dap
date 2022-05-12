import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-tracer";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const publisherPrivateKey = "A979CC3CCF65C4397AC5355F09874507D667D6391C5BEEC18745833B54E2FA79";
const advertiserPrivateKey = "C77457343A76C24BFF8AFD44C1C82C16C8467E9978B4A9668B2D875F10805526";
const viewerPrivateKey = "1ED86563DABAF9787492325FA6057DD629C361147572479AE797CB87BE1E8C2C";

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    // ropsten: {
    //   url: process.env.ROPSTEN_URL || "",
    //   accounts:
    //     process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    // },
    huygens: {
      url: "https://test-huygens.computecoin.info/",
      accounts: [publisherPrivateKey,advertiserPrivateKey, viewerPrivateKey]
    }    
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
