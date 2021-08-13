import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { GreenToken } from "../typechain/GreenToken";
import { GreenVault } from "../typechain/GreenVault";

const { deployContract } = hre.waffle;

declare module "mocha" {
  export interface Context {
    gtoken: GreenToken;
    another_token: GreenToken;

    gvault: GreenVault;
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

  describe("GreenVault", function () {
    const starting_balance = 1337;

    beforeEach(async function () {
      this.gtoken = <GreenToken>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("GreenToken"), []);

      this.another_token = <GreenToken>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("GreenToken"), []);

      this.gvault = <GreenVault>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("GreenVault"), []);

      for (const user of [this.signers.user1, this.signers.user2]) {
        await this.gtoken.connect(user).mint(user.address, starting_balance);
      }
    });

    it("starts empty", async function () {
      expect(await this.gvault.connect(this.signers.user1).deposits(this.signers.user1.address, this.gtoken.address))
        .to.be.equal(0);
    });

    it("doesn't accepts transfers without approvals", async function () {
      await expect(this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance))
        .to.be.reverted; // can't check for exact message since it's ERC20-generated and is not prescribed
    });

    it("doesn't accepts out-of-balance transfers", async function () {
      await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance * 2);

      await expect(this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance * 2))
        .to.be.reverted; // can't check for exact message since it's ERC20-generated and is not prescribed
    });

    describe("transfers", function () {
      beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
      });
      it("change balance", async function () {
        await expect(() => this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance))
          .to.changeTokenBalances(this.gtoken, [this.signers.user1, this.gvault], [-starting_balance, starting_balance]);

        expect(await this.gvault.connect(this.signers.user1).deposits(this.signers.user1.address, this.gtoken.address))
          .to.be.equal(starting_balance);
      });

      it("emit events", async function () {
        await expect(this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance))
          .to.emit(this.gvault, "EventDeposit").withArgs(this.signers.user1.address, this.gtoken.address, starting_balance);
      });

      it("don't change other user's balance", async function () {
        await this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance);

        expect(await this.gvault.connect(this.signers.user2).deposits(this.signers.user2.address, this.gtoken.address))
          .to.be.equal(0);

      });

      it("don't change other token's balance", async function () {
        await this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance);

        expect(await this.gvault.connect(this.signers.user1).deposits(this.signers.user1.address, this.another_token.address))
          .to.be.equal(0);

      });

    });

    describe("withdrawals", function () {
      beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
        await this.gvault.connect(this.signers.user1).deposit(this.gtoken.address, starting_balance);
      });

      it("by different users are not permitted", async function () {
        await expect(this.gvault.connect(this.signers.user2).withdraw(this.gtoken.address, 1))
          .to.be.revertedWith("InsufficientBalance");
      })

      it("to different token are not permitted", async function () {
        await expect(this.gvault.connect(this.signers.user1).withdraw(this.another_token.address, 1))
          .to.be.revertedWith("InsufficientBalance");
      })

      it("with insufficient balance are not permitted ", async function () {
        await expect(this.gvault.connect(this.signers.user1).withdraw(this.gtoken.address, starting_balance * 2))
          .to.be.revertedWith("InsufficientBalance");
      })

      it("change the balance", async function () {
        await expect(() => this.gvault.connect(this.signers.user1).withdraw(this.gtoken.address, starting_balance))
          .to.changeTokenBalances(this.gtoken, [this.signers.user1, this.gvault], [starting_balance, -starting_balance]);

        expect(await this.gvault.connect(this.signers.user1).deposits(this.signers.user1.address, this.gtoken.address))
          .to.be.equal(0);
      })

      it("emit correct message", async function () {
        await expect(this.gvault.connect(this.signers.user1).withdraw(this.gtoken.address, starting_balance))
          .to.emit(this.gvault, "EventWithdraw").withArgs(this.signers.user1.address, this.gtoken.address, starting_balance);
      })

    });
  });
});
