import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

task("deploy")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const addresses: {[name: string]: string} = {};
    const initializers : {[name: string]: () => Iterable<any>} = {
      "GreenToken": () => {return []},
      "GreenVault": () => {return [addresses["GreenToken"]];}
    }

    for (const contract_name in initializers) {
      console.log("Deploying ", contract_name);

      const factory = await ethers.getContractFactory(contract_name);
      const args = initializers
      [contract_name]();

      const contract = await factory.deploy(...args);
      await contract.deployed();
      addresses[contract_name] = contract.address;
      console.log(contract_name, " deployed to: ", contract.address);
    }
  });
