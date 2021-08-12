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
        .to.emit(this.wr, "WordRegistered").withArgs(word, this.signers.user1.address);
    });

    it("should preserve ownership of words", async function () {
      const word = "sss";
      expect(await this.wr.connect(this.signers.user1).wordToOwner(word))
        .to.equal(NULL_ADDRESS);

      await this.wr.connect(this.signers.user1).register(word);

      expect(await this.wr.connect(this.signers.user1).wordToOwner(word))
        .to.equal(this.signers.user1.address);
    });

    it("should allow users to unregister words", async function () {
      const word = "sss";
      await this.wr.connect(this.signers.user1).register(word);

      // user2 can't unregister
      await expect(this.wr.connect(this.signers.user2).unregister(word))
        .to.be.revertedWith("not registered by you");

      await expect(this.wr.connect(this.signers.user1).unregister(word))
        .to.emit(this.wr, "WordUnregistered").withArgs(word, this.signers.user1.address);
      expect(await this.wr.connect(this.signers.user1).wordToOwner(word))
        .to.equal(NULL_ADDRESS);
    })

    it("should allow words to be re-registered", async function () {
      const word = "sss";
      await this.wr.connect(this.signers.user1).register(word);
      await this.wr.connect(this.signers.user1).unregister(word);

      await expect(this.wr.connect(this.signers.user2).register(word))
        .to.not.be.reverted;

      expect(await this.wr.connect(this.signers.user1).wordToOwner(word))
        .to.equal(this.signers.user2.address);
    })

    it("should not allow users to steal words", async function () {
      const word = "sss";
      await expect(this.wr.connect(this.signers.user1).register(word))
        .to.not.be.reverted;
      // user2 is trying to steal
      await expect(this.wr.connect(this.signers.user2).register(word))
        .to.be.revertedWith("already registered");
    });
  });
});
