import hre, { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { GreenVault } from "../typechain/GreenVault";
import { FixedNumber } from "@ethersproject/bignumber";
import { DAI } from "../typechain/DAI";
import { MockAggregatorV3 } from "../typechain/MockAggregatorV3";
import { parseEther } from "ethers/lib/utils";

const { deployContract } = hre.waffle;

const DAI_abi = require("../abis/DAI.json");
const DAI_ward = "0x9759A6Ac90977b93B58547b4A71c78317f391A28";

declare module "mocha" {
  export interface Context {
    dai: DAI;

    priceFeed: MockAggregatorV3;
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


    this.dai = <DAI>(await ethers.getContractAt(DAI_abi, "0x6b175474e89094c44da98b954eedeac495271d0f", await hre.ethers.getSigner(DAI_ward)));
    console.log("contract fetched");
    // we're on mainnet fork, so let's impersonate a ward (contract's creator is one of them)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_ward],
    });
    // let's fund the guy - he needs to pay tx costs
    await network.provider.send("hardhat_setBalance", [
      DAI_ward,
      parseEther("10").toHexString(),
    ]);
  });

  const deposit = parseEther("1");
  describe("GreenVault", function () {
    beforeEach(async function () {
      this.priceFeed = (<MockAggregatorV3>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("MockAggregatorV3"), [false, 1, 0]));

      this.gvault = (<GreenVault>await deployContract(this.signers.admin,
        await hre.artifacts.readArtifact("GreenVault"), [this.dai.address, this.priceFeed.address]))
        .connect(this.signers.user1);

      // vault starts with 10 DAI
      await this.dai.mint(this.gvault.address, parseEther("10"));
    });

    it("starts empty", async function () {
      expect(await this.dai.balanceOf(this.signers.user1.address))
        .to.be.equal(0);
      expect(await (await this.gvault.users(this.signers.user1.address)).borrowedDAI)
        .to.be.equal(0);
    });

    describe("deposits", function () {
      it("change balance", async function () {
        await expect(() => this.gvault.deposit({ value: deposit }))
          .to.changeEtherBalances([this.signers.user1, this.gvault], ["-" + deposit.toString(), deposit]);

        expect((await this.gvault.users(this.signers.user1.address)).deposited)
          .to.be.equal(deposit);
      });

      it("emit events", async function () {
        await expect(this.gvault.deposit({ value: deposit }))
          .to.emit(this.gvault, "Deposited").withArgs(deposit);
      });

      it("don't change other user's balance", async function () {
        await expect(() => this.gvault.deposit({ value: deposit }))
          .to.changeEtherBalance(this.signers.user2, 0);

      });
    });

    describe("borrowings", function () {
      beforeEach(async function () {
        await this.gvault.deposit({ value: deposit });
        await this.priceFeed.setAnswer(1, 0); // 1 ETH -> 1 DAI
      });

      it("change balance", async function () {
        await this.gvault.borrow(deposit);
        expect((await this.gvault.users(this.signers.user1.address)).borrowedDAI)
          .to.be.equal(deposit);
      });

      it("don't over borrow", async function () {
        await this.gvault.borrow(deposit);
        await expect(this.gvault.borrow(deposit))
          .to.be.revertedWith("Not enough collateral (b)");
      });

      it("emit events", async function () {
        await expect(this.gvault.borrow(deposit))
          .to.emit(this.gvault, "Borrowed").withArgs(deposit, deposit);
      });

      [{ v: 1, d: 0, e: "1" }, { v: 2, d: 0, e: "2" }, { v: 1e17, d: 18, e: "0.1" }].forEach(function (priceData) {
        describe(`transfers DAI ${JSON.stringify(priceData)}`, function () {
          beforeEach(async function () {
            await this.priceFeed.setAnswer(priceData.v.toString(), priceData.d);
            await this.gvault.deposit({ value: deposit });
          });
          it("works", async function () {
            await expect(() => this.gvault.borrow(deposit))
              .to.changeTokenBalances(this.dai,
                [this.signers.user1, this.gvault],
                [parseEther(priceData.e).toString(), "-" + parseEther(priceData.e).toString()]
              );
          })
        })
      });

      it("works with changing price feed", async function () {
        // double the deposit
        await this.gvault.deposit({ value: deposit });
        // spend half of ETH with 1:1 rate
        await this.gvault.borrow(deposit);
        // spend another half of ETH with 1:2 rate
        await this.priceFeed.setAnswer(2, 0);

        await expect(() => this.gvault.borrow(deposit))
          .to.changeTokenBalance(this.dai, this.signers.user1, deposit.mul(2));

        const user_data = await this.gvault.users(this.signers.user1.address);
        expect(user_data.borrowedDAI)
          .to.be.equal(deposit.mul(3));
      });

      it("doesn't work with stale feed", async function () {
        // spend another half of ETH with 1:2 rate
        await this.priceFeed.setIsStale(true);

        await expect(this.gvault.borrow(deposit))
          .to.be.revertedWith("Stale feed");
      });
    });

    describe("paybacks", function () {
      beforeEach(async function () {
        await this.gvault.deposit({ value: deposit });
        await this.gvault.borrow(deposit);
        await this.dai.connect(this.signers.user1).approve(this.gvault.address, deposit);
      });

      it("change balance", async function () {
        await this.gvault.payback(deposit);
        expect((await this.gvault.users(this.signers.user1.address)).borrowedDAI)
          .to.be.equal(0);
      });

      it("don't over payback", async function () {
        await this.gvault.payback(deposit);
        await expect(this.gvault.payback(deposit))
          .to.be.revertedWith("Not enough debt");
      });

      it("emit events", async function () {
        await expect(this.gvault.payback(deposit))
          .to.emit(this.gvault, "PaidBack").withArgs(deposit, deposit);
      });

      it("works with changing price feed", async function () {
        // payback half of ETH with 1:1 rate
        await (expect(() => this.gvault.payback(deposit.div(2))))
          .to.changeTokenBalance(this.dai, this.signers.user1, "-" + deposit.div(2).toString())

        // payback another half of ETH with 1:0.5 rate
        await this.priceFeed.setAnswer(5, 1);

        // expect only half of DAI was required!
        await (expect(() => this.gvault.payback(deposit.div(2))))
          .to.changeTokenBalance(this.dai, this.signers.user1, "-" + deposit.div(4).toString())
      });

      it("doesn't work with stale feed", async function () {
        // spend another half of ETH with 1:2 rate
        await this.priceFeed.setIsStale(true);

        await expect(this.gvault.payback(deposit))
          .to.be.revertedWith("Stale feed");
      });
    });

    describe("paybacks", function () {
      beforeEach(async function () {
        await this.dai.connect(this.signers.user1).approve(this.gvault.address, deposit);
      });

      [{ v: 1, d: 0, e: "1" }, { v: 2, d: 0, e: "2" }, { v: 1e17, d: 18, e: "0.1" }].forEach(function (priceData) {
        describe(`accepts DAI ${JSON.stringify(priceData)}`, function () {
          beforeEach(async function () {
            await this.priceFeed.setAnswer(priceData.v.toString(), priceData.d);

            await this.gvault.deposit({ value: deposit });
            await this.gvault.borrow(deposit);
            // give the user more DAI to repay
            await this.dai.mint(this.signers.user1.address, deposit);
            await this.dai.connect(this.signers.user1).approve(this.gvault.address, deposit.mul(2));
          });
          it("works", async function () {
            await expect(() => this.gvault.payback(deposit))
              .to.changeTokenBalances(this.dai,
                [this.signers.user1, this.gvault],
                ["-" + parseEther(priceData.e).toString(), parseEther(priceData.e).toString()]
              );
          })
        })
      });
    });


    describe("withdraws", function () {
      beforeEach(async function () {
        // payback 0.5 of deposit
        await this.gvault.deposit({ value: deposit });

        await this.gvault.borrow(deposit);
        await this.dai.connect(this.signers.user1).approve(this.gvault.address, deposit);
        await this.gvault.payback(deposit.div(2));
      });

      it("change balance", async function () {
        await expect(() => this.gvault.withdraw(deposit.div(2)))
          .to.changeEtherBalances([this.signers.user1, this.gvault], [deposit.div(2), "-" + deposit.div(2).toString()]);

        expect((await this.gvault.users(this.signers.user1.address)).deposited)
          .to.be.equal(deposit.div(2));
      });

      it("can't over withdraw when there's debt", async function () {
        await (expect(this.gvault.withdraw(deposit)))
          .to.be.revertedWith("Not enough collateral(w)");
      });

      it("can't over withdraw when there's no debt", async function () {
        await this.gvault.payback(deposit.div(2));
        // no debt at this point
        await (expect(this.gvault.withdraw(deposit.add(1))))
          .to.be.revertedWith("Not enough ETH (w)");
      });

      it("emit events", async function () {
        await expect(this.gvault.withdraw(deposit.div(2)))
          .to.emit(this.gvault, "Withdrawn").withArgs(deposit.div(2));
      });

      it("don't change other user's balance", async function () {
        await expect(() => this.gvault.withdraw(deposit.div(2)))
          .to.changeEtherBalance(this.signers.user2, 0);
      });
    });

    describe("liquidations", function () {
      beforeEach(async function () {
        await this.gvault.deposit({ value: deposit });
        await this.gvault.borrow(deposit);
        await this.priceFeed.setAnswer(5, 1); // 1 ETH -> .5 DAI
      });

      it("can be made by owner", async function () {
        await this.gvault.connect(this.signers.admin).liquidate(this.signers.user1.address);
      });

      it("can't be made by regular users'", async function () {
        await (expect(this.gvault.liquidate(this.signers.user1.address)))
          .to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("can't be made if there's no bad debt", async function () {
        await this.priceFeed.setAnswer(1, 0); // 1 ETH -> 1 DAI
        await (expect(this.gvault.connect(this.signers.admin).liquidate(this.signers.user1.address)))
          .to.be.revertedWith("Good debt");
      });

      it("wipe out the debt", async function () {
        await this.gvault.connect(this.signers.admin).liquidate(this.signers.user1.address);

        const userData = await this.gvault.users(this.signers.user1.address);
        expect(userData.borrowedDAI).to.be.equal(0);
        expect(userData.deposited).to.be.equal(0);
      });

      it("emits event", async function () {
        await expect(this.gvault.connect(this.signers.admin).liquidate(this.signers.user1.address))
          .to.emit(this.gvault, "Liquidated").withArgs(this.signers.user1.address);
      });
    });
  });
});
