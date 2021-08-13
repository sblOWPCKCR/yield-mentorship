import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { WordRegistry, WordRegistry__factory } from "../../typechain";

task("deploy:WordRegistry")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const factory: WordRegistry__factory = await ethers.getContractFactory("WordRegistry");
    console.log("Deploying...");
    const contract: WordRegistry = <WordRegistry>await factory.deploy();
    await contract.deployed();
    console.log("Contract deployed to: ", contract.address);
  });
