import { providers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

// Standard json rpc provider directly from ethers.js (NOT Flashbots)
const provider = new providers.JsonRpcProvider({ url: ETHEREUM_RPC_URL }, 1)

// `authSigner` is an Ethereum private key that does NOT store funds and is NOT your bot's primary key.
// This is an identifying key for signing payloads to establish reputation and whitelisting
// In production, this should be used across multiple bundles to build relationship. In this example, we generate a new wallet each time
const authSigner = Wallet.createRandom();

// Flashbots provider requires passing in a standard provider
const flashbotsProvider = await FlashbotsBundleProvider.create(
  provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
  authSigner // ethers.js signer wallet, only for signing request payloads, not transactions
)

task('bnd-setcommitseed').setAction(async function () {
    // run the following command:
    // while true; do npx hardhat bnd-seedcommits --network eden; sleep 420; done
    const [sender] = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("BnDGameCR", deployments.BnDGameCR);
    // Generate random number
    const value = randomBytes(32);
    const randNum = BigNumber.from(value);
    console.log(`${new Date().toString()} - Setting random value for seed: ${randNum.toString()}`);
    await (await gameContract.addCommitRandom(randNum)).wait();
    console.log("Seed set!");

});