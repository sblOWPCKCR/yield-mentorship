import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { GreenToken } from "../typechain/GreenToken";
import { GreenVault } from "../typechain/GreenVault";
import { FixedNumber } from "@ethersproject/bignumber";

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

      this.gvault = (<GreenVault>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("GreenVault"), [this.gtoken.address, (2 * (10 ** 18)).toString()]))
        .connect(this.signers.user1);

      for (const user of [this.signers.user1, this.signers.user2]) {
        await this.gtoken.connect(user).mint(user.address, starting_balance);
      }
    });

    it("starts empty", async function () {
      expect(await this.gvault.balanceOf(this.signers.user1.address))
        .to.be.equal(0);
    });

    it("doesn't accepts transfers without approvals", async function () {
      await expect(this.gvault.deposit(starting_balance))
        .to.be.reverted; // can't check for exact message since it's ERC20-generated and is not prescribed
    });

    it("doesn't accepts out-of-balance transfers", async function () {
      await this.gtoken.approve(this.gvault.address, starting_balance * 2);

      await expect(this.gvault.deposit(starting_balance * 2))
        .to.be.reverted; // can't check for exact message since it's ERC20-generated and is not prescribed
    });

    describe("mints", function () {
      beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
      });
      it("change balance", async function () {
        await expect(() => this.gvault.deposit(starting_balance))
          .to.changeTokenBalances(this.gtoken,
            [this.signers.user1, this.gvault],
            [-starting_balance, starting_balance]);

        expect(await this.gvault.balanceOf(this.signers.user1.address))
          .to.be.equal(2 * starting_balance);
      });

      it("emit events", async function () {
        await expect(this.gvault.deposit(starting_balance))
          .to.emit(this.gvault, "Minted").withArgs(this.signers.user1.address, this.gtoken.address, 2 * starting_balance);
      });

      it("don't change other user's balance", async function () {
        await expect(() => this.gvault.deposit(starting_balance))
          .to.changeTokenBalance(this.gtoken, this.signers.user2, 0);

      });
    });

    describe("burns", function () {
      beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
        await this.gvault.deposit(starting_balance);
      });

      it("by different users are not permitted", async function () {
        await expect(this.gvault
          .connect(this.signers.user2)
          .withdraw(1))
          .to.be.revertedWith("ERC20: Insufficient balance");
      })

      it("with insufficient balance are not permitted ", async function () {
        await expect(this.gvault.withdraw(starting_balance * 2))
          .to.be.revertedWith("ERC20: Insufficient balance");
      })

      it("change the balance", async function () {
        await expect(() => this.gvault.withdraw(starting_balance))
          .to.changeTokenBalances(this.gtoken, [this.signers.user1, this.gvault], [starting_balance, -starting_balance]);

        expect(await this.gvault.balanceOf(this.signers.user1.address))
          .to.be.equal(0);
      })

      it("emit correct message", async function () {
        await expect(this.gvault.withdraw(starting_balance))
          .to.emit(this.gvault, "Burned").withArgs(this.signers.user1.address, this.gtoken.address, starting_balance * 2);
      })
    });

    it("exchange rate can be increased by admin", async function () {
      const newR = (4 * (10 ** 18)).toString();
      await expect(this.gvault.connect(this.signers.admin).setExchangeRate(newR))
        .to.emit(this.gvault, "ExchangeRateSet").withArgs(newR);
      expect(await this.gvault.exchangeRateWad())
        .to.be.equal(newR);
    })

    it("exchange rate can not be changed by users", async function () {
      const newR = (4 * (10 ** 18)).toString();
      await expect(this.gvault.connect(this.signers.user1).setExchangeRate(newR))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("exchange rate can be *fractional*", async function () {
      const newR = '1234567890123456789'; // 1.2345...
      await this.gvault.connect(this.signers.admin).setExchangeRate(newR);

      const WAD = (1 * (10 ** 18)).toString();

      await this.gtoken.connect(this.signers.user2)
        .mint(this.signers.user2.address, WAD);
      await this.gtoken.connect(this.signers.user2)
        .approve(this.gvault.address, WAD);
      await this.gvault.connect(this.signers.user2)
        .deposit(WAD);

      let balance = FixedNumber.fromValue((await this.gvault.balanceOf(this.signers.user2.address)), 18);
      expect(balance.toUnsafeFloat()).to.be.closeTo(1.234567890123456789, 0.00000001);
    })

    const initialDeposit = 100;
    describe("after increasing R", function () {
      this.beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
        // deposit a bit
        await this.gvault.deposit(initialDeposit);
        // double the amount of rewards
        await this.gvault.connect(this.signers.admin).setExchangeRate((4 * (10 ** 18)).toString());
      })

      it("deposits produce more vault tokens", async function () {
        await expect(() => this.gvault.deposit(1))
          .to.changeTokenBalance(this.gvault, this.signers.user1, 4);
      })

      it("withdraws need more vault tokens", async function () {
        await this.gvault.withdraw(initialDeposit / 2);
        expect(await this.gvault.balanceOf(this.signers.user1.address))
          .to.be.equal(0);
      })
    });

    describe("after decreasing R", function () {
      this.beforeEach(async function () {
        await this.gtoken.connect(this.signers.user1).approve(this.gvault.address, starting_balance);
        // deposit a bit
        await this.gvault.deposit(initialDeposit);
        // half the amount of rewards
        await this.gvault.connect(this.signers.admin).setExchangeRate((1 * (10 ** 18)).toString());
      })

      it("deposits produce fewer vault tokens", async function () {
        await expect(() => this.gvault.deposit(10))
          .to.changeTokenBalance(this.gvault, this.signers.user1, 10);
      })

      it("withdraws need fewer vault tokens", async function () {
        await this.gvault.withdraw(initialDeposit);
        expect(await this.gvault.balanceOf(this.signers.user1.address))
          .to.be.equal(initialDeposit);
      })
    });
  });
});
