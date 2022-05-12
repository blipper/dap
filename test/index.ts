import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractFactory } from "ethers";
import { ethers, waffle } from "hardhat";

require("@nomiclabs/hardhat-waffle");

import {ImpressionBlindAuction } from "../typechain-types/ImpressionBlindAuction";

describe("AdsAuction", function () {
  let publisher : SignerWithAddress;
  let adverstiser : SignerWithAddress;
  let viewer : SignerWithAddress;
  let ImpressionBlindAuctionContractFactory : ContractFactory;
  let pubInfo : ImpressionBlindAuction.PublisherStruct;
  let viewInfo : ImpressionBlindAuction.ViewerStruct;
  before(async function () {
    ImpressionBlindAuctionContractFactory = await ethers.getContractFactory("ImpressionBlindAuction");
    [publisher, adverstiser, viewer] = await ethers.getSigners();
    pubInfo = {
      publisher: await publisher.getAddress(),
      floorPrice: 10,
    }
    viewInfo = {
      viewer: await viewer.getAddress(),
      ask: 1,
      publisherSecret: ethers.utils.randomBytes(4)
    }

  });

  it("Should deploy", async function () {
    const impressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo);
    await impressionBlindAuction.deployed();
  });


  it("Should deploy but fail due to exceeded time", async function () {
    await expect(ImpressionBlindAuctionContractFactory.deploy(250, pubInfo)).to.be.reverted;
  });

  it("Should accept publish with floor of 10 and viewer with a non-zero ask price", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
  });

  it("Should not allow viewer info being set by publisher", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await expect(impressionBlindAuction.supplyViewer(viewInfo)).to.be.reverted;
  });

  it("Should not allow viewer info to be set twice", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    await expect(impressionBlindAuction.connect(viewer).supplyViewer(viewInfo)).to.be.reverted;
  });


  const bidSecret = ethers.utils.randomBytes(32);
  const packAndBlind = (bid : number, fake : boolean) : string => {
    return ethers.utils.solidityKeccak256([ "uint", "bool", "bytes32" ], [ bid, fake, bidSecret ]);
  }

  it("Should allow a bids with viewer info", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
  });


  it("Should allow a bids without viewer info", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
  });

  it("Should allow a fake bid", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,true),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
  });

  it("Should allow a real bid and a fake bid", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidFake: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidFake,true),{value: ethers.utils.parseUnits(bidFake.toString(),"wei")});
  });


  it("Should allow the collection period to end", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
  });

  it("Should not allow the collection period to end twice", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret)).to.be.reverted;
  });

  it("Should not allow bids after the collection period", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    const bidTwo:number = 50;
    await expect(impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidTwo,false),{value: ethers.utils.parseUnits(bidTwo.toString(),"wei")})).to.be.reverted;
  });

  it("Should not allow the collection period to be ended by anyone other than the advertiser", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await expect(impressionBlindAuction.connect(adverstiser).endBidsCollection(viewInfo.publisherSecret)).to.be.reverted;
  });

  it("Should allow an auction with a revealed bid bid with no refund ", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,false),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bid],[false],[bidSecret])).to.changeEtherBalance(adverstiser,0);    
  });

  it("Should allow an auction with a fake bid with a refund ", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bid:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bid,true),{value: ethers.utils.parseUnits(bid.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bid],[true],[bidSecret])).to.changeEtherBalance(adverstiser,bid);    
  });

  it("Should allow an auction with a real bit and a fake bid with a refund ", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidFake: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidFake,true),{value: ethers.utils.parseUnits(bidFake.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidFake],[false,true],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,100);    
  });

  it("Should update highest bid after two bids", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidRealTwo: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidRealTwo,false),{value: ethers.utils.parseUnits(bidRealTwo.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidRealTwo],[false,false],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,100).to.emit(impressionBlindAuction,"NewHighestBid").withArgs(()=> adverstiser.getAddress(), 100);
  });

  it("Should update highest bid after two bids", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidRealTwo: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidRealTwo,false),{value: ethers.utils.parseUnits(bidRealTwo.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidRealTwo],[false,false],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,100).to.emit(impressionBlindAuction,"NewHighestBid").withArgs(()=> adverstiser.getAddress(), 100);
  });



  it("Should allow an auction with a with refunded bids to end", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidFake: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidFake,true),{value: ethers.utils.parseUnits(bidFake.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidFake],[false,true],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,100);
    await expect(impressionBlindAuction.auctionEnd()).to.emit(impressionBlindAuction, "AuctionEnded");
  });


  it("Should send ask to the viewer", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bidReal],[false],[bidSecret])).to.changeEtherBalance(adverstiser,0);
    await expect(() => impressionBlindAuction.auctionEnd()).to.changeEtherBalance(viewer, 1);
  });

  it("Should only allow publisher to end the auction", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(impressionBlindAuction.connect(adverstiser).auctionEnd()).to.be.reverted;
  });

  it("Should only allow publisher to end the auction once", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await impressionBlindAuction.auctionEnd()
    await expect(impressionBlindAuction.auctionEnd()).to.be.reverted;
  });

  it("Should emit warning at auction end if not all bids revealed", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidFake: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidReal.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidFake,true),{value: ethers.utils.parseUnits(bidFake.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidFake],[false,true],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,100);
    await expect(impressionBlindAuction.auctionEnd())
      .to.emit(impressionBlindAuction, "NotAllBidsRevealed").withArgs(1)
      .to.emit(impressionBlindAuction, "AuctionEnded").withArgs(()=> adverstiser.getAddress(),bidReal);
  });


  it("Should allow an overbid to be withdrawn", async function () {
    const impressionBlindAuction: ImpressionBlindAuction = await ImpressionBlindAuctionContractFactory.deploy(50, pubInfo) as ImpressionBlindAuction;
    await impressionBlindAuction.connect(viewer).supplyViewer(viewInfo);
    const bidReal:number = 50;
    const bidOverbid:number = 500;
    const bidFake: number = 100;
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidReal,false),{value: ethers.utils.parseUnits(bidOverbid.toString(),"wei")});
    await impressionBlindAuction.connect(adverstiser).bid(packAndBlind(bidFake,true),{value: ethers.utils.parseUnits(bidFake.toString(),"wei")});
    await impressionBlindAuction.endBidsCollection(viewInfo.publisherSecret);
    await expect(() => impressionBlindAuction.connect(adverstiser).reveal([bidReal,bidFake],[false,true],[bidSecret, bidSecret])).to.changeEtherBalance(adverstiser,550);
    await expect(() => impressionBlindAuction.auctionEnd()).to.changeEtherBalance(publisher,bidReal-(viewInfo.ask.valueOf() as number));
  });





});
