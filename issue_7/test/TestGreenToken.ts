import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { GreenToken } from "../typechain/GreenToken";

const { deployContract } = hre.waffle;

declare module "mocha" {
  export interface Context {
    gtoken: GreenToken;
    // loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: { admin: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress };
  }
}

describe("Unit tests", function () {
  before(async function () {
    const signers = await hre.ethers.getSigners();
    this.signers = {
      admin: signers[0],
      user1: signers[1],
      user2: signers[2],
    }
  });

  describe("GreenToken", function () {
    beforeEach(async function () {
      const artifact: Artifact = await hre.artifacts.readArtifact("GreenToken");
      this.gtoken = <GreenToken>await deployContract(this.signers.admin, artifact, []);
    });

    it("should be mintable", async function () {
      const tokens = 100;
      await expect(this.gtoken.connect(this.signers.user1).mint(this.signers.user1.address, tokens))
        .to.not.be.reverted;

      expect(await this.gtoken.connect(this.signers.admin).balanceOf(this.signers.user1.address))
        .to.equal(tokens);
    });
  });
});
