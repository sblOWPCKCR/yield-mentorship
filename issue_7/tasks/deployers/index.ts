import { Contract } from "ethers";
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

task("deploy")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {

    async function deploy(contract_name: string, args: Iterable<any>): Promise<Contract> {
      console.log("Deploying ", contract_name);

      const factory = await ethers.getContractFactory(contract_name);

      const contract = await factory.deploy(...args);
      await contract.deployed();
      console.log(contract_name, " deployed to: ", contract.address);
      return contract;
    };

    const t1 = await deploy("GreenToken", []);
    const t2 = await deploy("GreenToken", []);
    await deploy("GreenAMM", [t1.address, t2.address]);
  });
