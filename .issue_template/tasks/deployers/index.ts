import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

task("deploy")
    .addParam("greeting", "Say hello, be nice")
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        for (const contract_name of ["Greeter"]) {
            const factory = await ethers.getContractFactory(contract_name);
            const contract = await factory.deploy(taskArguments.greeting);
            await contract.deployed();
            console.log(contract_name, " deployed to: ", contract.address);
        }
    });
