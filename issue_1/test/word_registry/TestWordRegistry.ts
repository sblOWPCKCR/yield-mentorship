import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { WordRegistry } from "../../typechain/WordRegistry";
import { Signers } from "../types";

const { deployContract } = hre.waffle;

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.user1 = signers[1];
    this.signers.user2 = signers[2];
    console.log("admin: ", this.signers.admin.address);
  });

  describe("WordRegistry", function () {
    beforeEach(async function () {
      const artifact: Artifact = await hre.artifacts.readArtifact("WordRegistry");
      this.wr = <WordRegistry>await deployContract(this.signers.admin, artifact, []);
    });

    it("should allow users to reserve words", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.emit(this.wr, "OwnershipChange").withArgs(word, NULL_ADDRESS, this.signers.user1.address);
    });

    it("should preserve ownership of words", async function () {
      const word = "sss";
      expect(await this.wr.connect(this.signers.user1).does_own(word))
        .to.equal(false);

      await this.wr.connect(this.signers.user1).register(word);

      expect(await this.wr.connect(this.signers.user1).does_own(word))
        .to.equal(true);
      expect(await this.wr.connect(this.signers.user2).does_own(word))
        .to.equal(false);
      expect(await this.wr.connect(this.signers.admin).does_own(word))
        .to.equal(false);
    });

    it("should allow users to unregister words", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.emit(this.wr, "OwnershipChange").withArgs(word, NULL_ADDRESS, this.signers.user1.address);

      // user2 can't unregister
      await expect(this.wr.connect(this.signers.user2).unregister(word))
        .to.be.reverted;

      await expect(this.wr.connect(this.signers.user1).unregister(word))
        .to.emit(this.wr, "OwnershipChange").withArgs(word, this.signers.user1.address, NULL_ADDRESS,);
      expect(await this.wr.connect(this.signers.user1).does_own(word))
        .to.equal(false);
    })

    it("should allow words to be re-registered", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.not.be.reverted;

      await expect(this.wr.connect(this.signers.user1).unregister(word))
        .to.not.be.reverted;

      await expect(this.wr.connect(this.signers.user2).register(word))
        .to.not.be.reverted;

      expect(await this.wr.connect(this.signers.user1).does_own(word))
        .to.equal(false);
      expect(await this.wr.connect(this.signers.user2).does_own(word))
        .to.equal(true);

    })

    it("should not allow users to steal words", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.not.be.reverted;
      // user2 is trying to steal
      await expect(this.wr.connect(this.signers.user2).register(word))
        .to.be.reverted;
    });

    it("should not allow the owner to steal words", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.not.be.reverted;
      // admin can't do this
      await expect(this.wr.connect(this.signers.admin).register(word))
        .to.be.reverted;
    });

    it("should allow the owner to expropriate", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.not.be.reverted;
      // admin can't do this
      await expect(this.wr.connect(this.signers.admin).expropriate(word))
        .to.emit(this.wr, "OwnershipChange").withArgs(word, this.signers.user1.address, this.signers.admin.address);
    });
  });
});
