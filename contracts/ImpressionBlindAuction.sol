//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";


contract ImpressionBlindAuction {
    struct Bid {
        bytes32 blindedBid;
        uint deposit;
    }

    //From https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf
    enum ContentCategory {IAB1,IAB1_1}
    enum CreativeAttributes {AudioAd_AutoPlay, AudioAd_User}
    enum Position {Unknown, AboveTheFold, BelowTheFold}

    struct ImpressionInfo {
        address viewer;
        address site;

        Position position;
        ContentCategory category;
        CreativeAttributes attributes;
    }

    struct Viewer {
        address payable viewer;
        uint ask;
        uint publisherSecret; // This is so that we know the viewer has visited the page
    }

    struct Publisher {
        address payable publisher;
        uint floorPrice;
    }

    Publisher public publisher;
    Viewer public viewer;
    enum AuctionState {PUBLISHED, BIDS_COLLECTED, BIDS_REVEALED}
    AuctionState auction_state = AuctionState.PUBLISHED;
    uint public estimatedBiddingPeriod_ms;
    mapping(address => Bid[]) public bids;
    uint bidsCount = 0; // Needed to key track for when state transition is allowed


    address public highestBidder;
    uint public highestBid;

    // Allowed withdrawals of previous bids
    EnumerableMap.AddressToUintMap private pendingReturns;
    // mapping(address => uint) pendingReturns;
    event AuctionEnded(address winner, uint highestBid);

    /// The function auctionEnd has already been called.
    error WrongState(AuctionState auction_state);
    error ViewerAlreadySet(Viewer);
    error NoPermission();
    error BidBelowViewerAsk();
    error BidBelowPublisherFloor();
    error WrongScret();
    event InvalidReveal(bytes32 blindedBid, bytes32 calculatedBid);
    event BidScan(Bid bid);
    event NotAllBidsRevealed(uint bidCount);
    event OverbidRefund(address bidder, uint amount);
    event NewHighestBid(address bidder, uint bid);

    uint constant MAX_BIDDING_PERIOD_MS = 100;
    constructor(
        uint _estimatedBiddingPeriod_ms,
        Publisher memory _publisher 
    ) {
        publisher = _publisher;
        estimatedBiddingPeriod_ms = _estimatedBiddingPeriod_ms;
        require(_estimatedBiddingPeriod_ms<MAX_BIDDING_PERIOD_MS, "Estimated bidding period is too long");
    }

    // The viewer will send a message from their account with their ask
    function supplyViewer(Viewer calldata _viewer) external {
        if (msg.sender != _viewer.viewer) {
            revert NoPermission();
        }
        if (viewer.viewer != address(0)) {
            revert ViewerAlreadySet(viewer);
        }
        if (auction_state != AuctionState.PUBLISHED) {
            revert WrongState(auction_state);
        }
        viewer = _viewer;
    }

    /// Place a blinded bid with `blindedBid` =
    /// keccak256(abi.encodePacked(value, fake, secret)).
    /// The sent ether is only refunded if the bid is correctly
    /// revealed in the revealing phase. The bid is valid if the
    /// ether sent together with the bid is at least "value" and
    /// "fake" is not true. Setting "fake" to true and sending
    /// not the exact amount are ways to hide the real bid but
    /// still make the required deposit. The same address can
    /// place multiple bids.
    function bid(bytes32 blindedBid)
        external
        payable
    {
        if (auction_state != AuctionState.PUBLISHED) {
            revert WrongState(auction_state);
        }

        bids[msg.sender].push(Bid({
            blindedBid: blindedBid,
            deposit: msg.value
        }));
        bidsCount++;
    }

    // This is called by the publisher when the collection period is over
    function endBidsCollection(uint publisherSecret) external {
        if (publisher.publisher != msg.sender) {
            revert NoPermission();
        }
        if (auction_state != AuctionState.PUBLISHED) {
            revert WrongState(auction_state);
        }
        if (viewer.viewer != address(0) && viewer.publisherSecret!=publisherSecret) {
            revert WrongScret();
        }

        auction_state = AuctionState.BIDS_COLLECTED;
    }

    /// Reveal your blinded bids. You will get a refund for all
    /// correctly blinded invalid bids and for all bids except for
    /// the totally highest.
    function reveal(
        uint[] calldata values,
        bool[] calldata fakes,
        bytes32[] calldata secrets
    )
        external
    {
        if (auction_state != AuctionState.BIDS_COLLECTED) {
            revert WrongState(auction_state);
        }
        uint length = bids[msg.sender].length;
        require(values.length == length);
        require(fakes.length == length);
        require(secrets.length == length);

        uint refund;
        for (uint i = 0; i < length; i++) {
            Bid storage bidToCheck = bids[msg.sender][i];
            (uint value, bool fake, bytes32 secret) =
                    (values[i], fakes[i], secrets[i]);
            emit BidScan(bidToCheck);
            if (bidToCheck.blindedBid != keccak256(abi.encodePacked(value, fake, secret))) {
                emit InvalidReveal(bidToCheck.blindedBid, keccak256(abi.encodePacked(value, fake, secret)));
                // Bid was not actually revealed.
                // Do not refund deposit.
                continue;
            }
            refund += bidToCheck.deposit;
            if (!fake && bidToCheck.deposit >= value) {
                if (placeBid(msg.sender, value))
                    refund -= value;
            }
            // Make it impossible for the sender to re-claim
            // the same deposit.
            bidToCheck.blindedBid = bytes32(0);
        }
        bidsCount=bidsCount-bids[msg.sender].length; 
        delete bids[msg.sender];
        payable(msg.sender).transfer(refund);


    }

    /// Withdraw bids that were overbid.
    function refundOverBids() internal {
        for (uint i = 0; i <  EnumerableMap.length(pendingReturns); i++) {
            (address bidder, uint amount) = EnumerableMap.at(pendingReturns, i);
            if (amount > 0) {
                // It is important to set this to zero because the recipient
                // can call this function again as part of the receiving call
                // before `transfer` returns (see the remark above about
                // conditions -> effects -> interaction).
                EnumerableMap.set(pendingReturns, bidder, 0);
                emit OverbidRefund(bidder, amount);
                payable(bidder).transfer(amount);
            }
        }
    }

    /// End the auction and send the highest bid
    /// to the beneficiary.
    function auctionEnd()
        external
    {
        if (publisher.publisher != msg.sender) {
            revert NoPermission();
        }
        if (auction_state != AuctionState.BIDS_COLLECTED) {
            revert WrongState(auction_state);
        }
        emit AuctionEnded(highestBidder, highestBid);
        emit NotAllBidsRevealed(bidsCount);
        if (highestBidder != address(0)) {
            publisher.publisher.transfer(highestBid - viewer.ask);
            if (viewer.viewer != address(0) && viewer.ask > 0) {
                viewer.viewer.transfer(viewer.ask);
            }
        }
        auction_state = AuctionState.BIDS_REVEALED;
        refundOverBids();
    }

    function placeBid(address bidder, uint value) internal
            returns (bool success)
    {
        // Make sure bid is valid subjects to the constraints
        if ((value <= highestBid || 
            (viewer.viewer != address(0) && value < viewer.ask) || 
            (value - viewer.ask < publisher.floorPrice))) {
            return false;
        }
        if (highestBidder != address(0)) {
            // Refund the previously highest bidder.
            uint256 highestBidderCurrentBid;
            if (EnumerableMap.contains(pendingReturns, highestBidder))
                highestBidderCurrentBid = EnumerableMap.get(pendingReturns, highestBidder);
            else
                highestBidderCurrentBid = 0;
            EnumerableMap.set(pendingReturns,highestBidder, highestBidderCurrentBid + highestBid);
        }
        highestBid = value;
        highestBidder = bidder;
        emit NewHighestBid(highestBidder, highestBid);
        return true;
    }
}