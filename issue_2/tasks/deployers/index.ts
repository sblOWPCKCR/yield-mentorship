import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

task("deploy")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    for (const contract_name of ["GreenToken", "GreenVault"]) {
      const factory = await ethers.getContractFactory(contract_name);
      const contract = await factory.deploy();
      await contract.deployed();
      console.log(contract_name, " deployed to: ", contract.address);
    }
  });
