const fs = require('fs');
const deployments = require('../data/deployments');

task('get-auction-events').setAction(async function () {
    const [deployer] = await ethers.getSigners();

    const instance = await ethers.getContractAt(
        'AuctionMint',
        // deployments.AuctionMint,
        '0xea5F32ed4044c44c44AB833d8071E672AAD142ff'
    );

    let filter = instance.filters.BidPlaced();
    let filterWinners = instance.filters.WinnerChosen();
    let filterRefunds = instance.filters.BidRefunded();

    let bidEvents = await instance.queryFilter(filter);
    let winnerEvents = await instance.queryFilter(filterWinners);
    let refundEvents = await instance.queryFilter(filterRefunds);

    // Tracks every bid placed, even repeat bids. Stores an address, pricePerMint tuple
    const arrayBids = [];
    //Holds the block number that an address won at
    const winnersMap = new Map();

    // go through each winner events from oldest to newest and save the block numbers.
    // This allows us to get the latest win for an address, which will only allow newer bids to be recorded and considered.
    for (let i = 0; i < winnerEvents.length; i++) {
        // go oldest to newest and save the blockNumber of every address that as won.
        // If there are multiple, the latest win will be recorded.
        const winnerEvent = winnerEvents[i];
        // Store the blockNumber for the given address for lookup later
        winnersMap.set(winnerEvent.args[1], parseInt(winnerEvent.blockNumber));
    }
    
    for (let i = bidEvents.length - 1; i >= 0; i--) {
        const bid = bidEvents[i];
        if(winnersMap.has(bid.args[1]) && winnersMap.get(bid.args[1]) > parseInt(bid.blockNumber)) {
            // skip any bids that happened before the address was picked as a winner
            //  (as these were part of the winning vote)
            continue;
        }
        arrayBids.push({
            addr: bid.args[1],
            pricePerMint: bid.args[3],
            qty: bid.args[4],
        });
    }

    let totalPrice = 0;
    let qty = 0;
    const bidders = [];
    let minAcceptedBid = 0;

    console.log("=========SORTED=========\n");
    //build an array that can be pasted into the smart contract to pickWinners
    let log = "[";
    // Sort by highest bid
    arrayBids.sort((a, b) => b.pricePerMint - a.pricePerMint);
    for (let i = 0; i < arrayBids.length; i++) {
        const bidCur = arrayBids[i];
        // Ignore repeat bids. Since this is sorted we know we have the highest and latest bid
        if(bidders.includes(bidCur.addr)) {
            continue;
        }
        bidders.push(bidCur.addr);
        log += `${bidCur.addr}`;
        totalPrice += parseFloat(bidCur.pricePerMint / 10**18);
        qty += parseFloat(bidCur.qty);
        if(qty >= 3000) {
            console.log(JSON.stringify(bidCur));
            minAcceptedBid = bidCur.pricePerMint;
            break;
        }
        if(i < arrayBids.length - 1) {
            log += ",";
        }
        else {
            minAcceptedBid = bidCur.pricePerMint;
        }
    }
    log += "]";
    console.log("pickWinners input");
    console.log(log);
    
    // Output the averages of the current bid
    const averagePrice = totalPrice / bidders.length;
    console.log(`Average PricePerMint: ${averagePrice.toFixed(4)}\nTotal mints: ${qty}\nLowest accepted bid: ${minAcceptedBid / 10**18}`);
});

task('get-pendingmint-events').setAction(async function () {
    const [deployer] = await ethers.getSigners();

    const instance = await ethers.getContractAt(
        'BnDGameCR',
        '0xAff60ba9eA1cfb2CCB668dAEd64c625e9489860f' // Old BnDGameCR contract
    );

    let filter = instance.filters.MintCommitted();

    let commits = await instance.queryFilter(filter);

    const arrayCommits = [];
    const arrayCommitsGardending = [];
    
    for (let i = commits.length - 1; i >= 0; i--) {
        if(i % 50 == 0) {
            console.log("checking i = ", i);
        }
        const commitCur = commits[i];
        const isGardending = await instance.callStatic.canMint(commitCur.args[0]);
        if(!isGardending) {
            // skip any commits that happened before the address was revealed
            continue;
        }
        arrayCommits.push({
            addr: commitCur.args[0],
            // pricePerMint: commitCur.args[3],
            qty: commitCur.args[1].toString(),
        });
    }
    console.log(arrayCommits);
    let output = JSON.stringify(arrayCommits);
    fs.writeFileSync('commit.json', output);
});



