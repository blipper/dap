// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import {ImpressionBlindAuction } from "../typechain-types/ImpressionBlindAuction";
import { getContractAddress }  from "@ethersproject/address";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  
  const ImpressionBlindAuctionContract = await ethers.getContractFactory("ImpressionBlindAuction");
  
  const [owner] = await ethers.getSigners()

  const transactionCount = await owner.getTransactionCount()

  const futureAddress = getContractAddress({
    from: owner.address,
    nonce: transactionCount
  })

  
  const pub : ImpressionBlindAuction.PublisherStruct = {
    publisher: futureAddress,
    floorPrice: 1,
  }

  const impressionBlindAuction = await ImpressionBlindAuctionContract.deploy(50, pub);

  await impressionBlindAuction.deployed();

  console.log("ImpressionBlindAuction deployed to:", impressionBlindAuction.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
