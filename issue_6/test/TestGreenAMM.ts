import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { GreenToken } from "../typechain/GreenToken";
import { GreenAMM } from "../typechain/GreenAMM";
import { FixedNumber } from "@ethersproject/bignumber";
import { parseEther } from "ethers/lib/utils";

const { deployContract } = hre.waffle;

declare module "mocha" {
  export interface Context {
    xToken: GreenToken;
    yToken: GreenToken;

    gAMM: GreenAMM;
    admin: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
  }
}

const tokenBalance = parseEther("1000");
const WAD = parseEther("1");
describe("Unit tests", function () {
  before(async function () {
    const signers = await hre.ethers.getSigners();
    this.admin = signers[0];
    this.user1 = signers[1];
    this.user2 = signers[2];
  });

  describe("GreenAMM", function () {
    beforeEach(async function () {
      this.xToken = <GreenToken>await deployContract(this.admin,
        await hre.artifacts.readArtifact("GreenToken"), []);
      this.yToken = <GreenToken>await deployContract(this.admin,
        await hre.artifacts.readArtifact("GreenToken"), []);

      this.gAMM = (<GreenAMM>await deployContract(this.admin,
        await hre.artifacts.readArtifact("GreenAMM"), [this.xToken.address, this.yToken.address]))
        .connect(this.user1);

      for (const user of [this.admin, this.user1, this.user2]) {
        await this.xToken.connect(user).mint(user.address, tokenBalance);
        await this.xToken.connect(user).approve(this.gAMM.address, tokenBalance);

        await this.yToken.connect(user).mint(user.address, tokenBalance);
        await this.yToken.connect(user).approve(this.gAMM.address, tokenBalance);
      }
    });

    it("starts empty", async function () {
      expect(await this.gAMM.balanceOf(this.user1.address))
        .to.be.equal(0);
    });

    describe("Init", function () {
      beforeEach(async function () {
        // re-create gAMM before each 'init' test
        this.gAMM = (<GreenAMM>await deployContract(this.admin,
          await hre.artifacts.readArtifact("GreenAMM"), [this.xToken.address, this.yToken.address]))
          .connect(this.admin);

        await this.xToken.connect(this.admin).approve(this.gAMM.address, tokenBalance);
        await this.yToken.connect(this.admin).approve(this.gAMM.address, tokenBalance);
      });

      it("can be done by the owner", async function () {
        this.gAMM.Init(1, 1);
      })

      it("can't be done by a non-owner", async function () {
        await expect(this.gAMM.connect(this.user1).Init(1, 1))
          .to.be.revertedWith("Ownable: caller is not the owner");
      })

      it("can be done only once", async function () {
        this.gAMM.Init(1, 1);
        await expect(this.gAMM.Init(1, 1))
          .to.be.revertedWith("already initialized");
      })

      it("can't create a pool with no tokens", async function () {
        await expect(this.gAMM.Init(1, 0))
          .to.be.revertedWith("Can't create empty pool");

        await expect(this.gAMM.Init(0, 1))
          .to.be.revertedWith("Can't create empty pool");
      })

      it("recomputes K", async function () {
        await expect(this.gAMM.Init(parseEther("7"), parseEther("191")))
          .to.emit(this.gAMM, "KChanged").withArgs(parseEther("1337").mul(WAD));
      })

      it("emits LP tokens", async function () {
        await expect(() => this.gAMM.Init(parseEther("7"), parseEther("191")))
          .to.changeTokenBalance(this.gAMM, this.admin, parseEther("1337").mul(WAD));

        expect(await this.gAMM.totalSupply())
          .to.be.equal(parseEther("1337").mul(WAD));
      })
    });

    describe("Mint", function () {
      beforeEach(async function () {
        // 1:5
        await this.gAMM.connect(this.admin).Init(parseEther("1"), parseEther("5"));
        // k == 5
        // total supply == 5
      });

      it("can't unbalance", async function () {
        await expect(this.gAMM.Mint(1, 10))
          .to.be.revertedWith("Unbalancing");
        await expect(this.gAMM.Mint(5, 1))
          .to.be.revertedWith("Unbalancing");
      })

      it("recomputes K", async function () {
        await expect(this.gAMM.Mint(parseEther("2"), parseEther("10")))
          .to.emit(this.gAMM, "KChanged").withArgs(parseEther("45").mul(WAD));
      })

      it("emits LP tokens", async function () {
        await expect(() => this.gAMM.Mint(parseEther("2"), parseEther("10")))
          .to.changeTokenBalance(this.gAMM, this.user1, parseEther("10").mul(WAD)); // double the original amount

        expect(await this.gAMM.totalSupply())
          .to.be.equal(parseEther("15").mul(WAD));
      })
    });

    describe("Burn", function () {
      beforeEach(async function () {
        // 1:5
        await this.gAMM.connect(this.admin).Init(parseEther("1"), parseEther("5"));
        await this.gAMM.Mint(parseEther("1"), parseEther("5"));
        // k == 20
        // total supply == 10
      });

      it("can't unbalance", async function () {
        await expect(this.gAMM.Burn(1, 10))
          .to.be.revertedWith("Unbalancing");
        await expect(this.gAMM.Burn(5, 1))
          .to.be.revertedWith("Unbalancing");
      })

      it("recomputes K", async function () {
        await expect(this.gAMM.Burn(parseEther("1"), parseEther("5")))
          .to.emit(this.gAMM, "KChanged").withArgs(parseEther("5").mul(WAD));
      })

      it("burns LP tokens", async function () {
        await this.gAMM.approve(this.gAMM.address, parseEther("5"))
        await expect(() => this.gAMM.Burn(parseEther("1"), parseEther("5")))
          .to.changeTokenBalance(this.gAMM, this.user1, "-" + parseEther("5").mul(WAD).toString()); // double the original amount

        expect(await this.gAMM.totalSupply())
          .to.be.equal(parseEther("5").mul(WAD));
      })
    });

    describe("SellX", function () {
      const xSupply = parseEther("10");
      const ySupply = parseEther("50");
      beforeEach(async function () {
        // 1:5
        await this.gAMM.connect(this.admin).Init(xSupply, ySupply);
        // k == 500
      });

      it("selling 0 tokens is allowed", async function () {
        await expect(() => this.gAMM.SellX(0))
          .to.changeTokenBalance(this.xToken, this.user1, 0)
      })

      it("changes balances", async function () {
        const yBalance = await this.yToken.balanceOf(this.user1.address);

        // k == 500
        // with 10 + 15 = 25 X tokens, the AMM only needs to keep 20 Y tokens => 30 tokens are returned
        await expect(() => this.gAMM.SellX(parseEther("15")))
          .to.changeTokenBalance(this.xToken, this.user1, "-" + parseEther("15").toString());

        expect((await this.yToken.balanceOf(this.user1.address)).sub(yBalance))
          .to.be.equal(parseEther("30"));
      })

      it("emits event", async function () {
        await expect(this.gAMM.SellX(parseEther("15")))
          .to.emit(this.gAMM, "SoldX").withArgs(parseEther("15"), parseEther("30"));
      })
    });

    describe("SellY", function () {
      const xSupply = parseEther("50");
      const ySupply = parseEther("10");
      beforeEach(async function () {
        // 5:1
        await this.gAMM.connect(this.admin).Init(xSupply, ySupply);
        // k == 500
      });

      it("selling 0 tokens is allowed", async function () {
        await expect(() => this.gAMM.SellY(0))
          .to.changeTokenBalance(this.xToken, this.user1, 0)
      })

      it("changes balances", async function () {
        const xBalance = await this.xToken.balanceOf(this.user1.address);

        // k == 500
        // with 10 + 15 = 25 Y tokens, the AMM only needs to keep 20 X tokens => 30 tokens are returned
        await expect(() => this.gAMM.SellY(parseEther("15")))
          .to.changeTokenBalance(this.yToken, this.user1, "-" + parseEther("15").toString());

        expect((await this.xToken.balanceOf(this.user1.address)).sub(xBalance))
          .to.be.equal(parseEther("30"));
      })

      it("emits event", async function () {
        await expect(this.gAMM.SellY(parseEther("15")))
          .to.emit(this.gAMM, "SoldY").withArgs(parseEther("30"), parseEther("15"));
      })
    });
  });
});
