import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { Greeter } from "../../typechain/Greeter";
import { Signers } from "../types";

const { deployContract } = hre.waffle;

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
  });

  describe("Greeter", function () {
    beforeEach(async function () {
      const greeting: string = "Hello, world!";
      const greeterArtifact: Artifact = await hre.artifacts.readArtifact("Greeter");
      this.greeter = <Greeter>await deployContract(this.signers.admin, greeterArtifact, [greeting]);
    });

    it("should return the new greeting once it's changed", async function () {
      expect(await this.greeter.connect(this.signers.admin).greet()).to.equal("Hello, world!");

      await this.greeter.setGreeting("Bonjour, le monde!");
      expect(await this.greeter.connect(this.signers.admin).greet()).to.equal("Bonjour, le monde!");
    });
  });
});
