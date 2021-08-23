import { Signer } from "@ethersproject/abstract-signer";
import { formatEther } from "ethers/lib/utils";
import { task } from "hardhat/config";

task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts: Signer[] = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress(), formatEther(await (await account.getBalance()).toString()));
  }
});
