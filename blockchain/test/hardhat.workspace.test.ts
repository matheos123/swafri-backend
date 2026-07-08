import { expect } from "chai";
import { ethers } from "hardhat";

describe("Hardhat workspace", function () {
  it("exposes a local Hardhat signer", async function () {
    const [signer] = await ethers.getSigners();
    expect(signer.address).to.match(/^0x[a-fA-F0-9]{40}$/);
  });
});
