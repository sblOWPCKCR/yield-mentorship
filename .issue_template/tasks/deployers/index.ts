import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { Greeter, Greeter__factory } from "../../typechain";

task("deploy:Greeter")
  .addParam("greeting", "Say hello, be nice")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const factory: Greeter__factory = await ethers.getContractFactory("Greeter");
    const contract: Greeter = <Greeter>await factory.deploy(taskArguments.greeting);
    await contract.deployed();
    console.log("Greeter deployed to: ", contract.address);
  });
