const { Connection, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } = require("@solana/web3.js");
const fs = require("fs");

const keypairPath = process.env.SOLANA_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 800;

// list of candidate devnet endpoints — add your paid RPC if you have one
const endpoints = [
  clusterApiUrl("devnet"),
  "https://api.devnet.solana.com",
  // "https://rpc-devnet.your-provider.com" // <-- add provider endpoint if available
];

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function loadSecret(keypath) {
  const raw = fs.readFileSync(keypath, "utf8");
  const kpJson = JSON.parse(raw);
  if (Array.isArray(kpJson)) return Uint8Array.from(kpJson);
  if (kpJson && Array.isArray(kpJson.secretKey)) return Uint8Array.from(kpJson.secretKey);
  if (kpJson && Array.isArray(kpJson._keypair?.secretKey)) return Uint8Array.from(kpJson._keypair.secretKey);
  throw new Error("Unrecognized keypair format");
}

(async () => {
  try {
    const secret = loadSecret(keypairPath);
    const keypair = Keypair.fromSecretKey(secret);

    for (const endpoint of endpoints) {
      const conn = new Connection(endpoint, "confirmed");
      console.log("Trying endpoint:", endpoint);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Attempt ${attempt} requesting airdrop to ${keypair.publicKey.toBase58()}`);
          const sig = await conn.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);

          // confirm using latest blockhash details
          const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
          await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "finalized");

          const bal = await conn.getBalance(keypair.publicKey, "finalized");
          console.log("Airdrop succeeded. Balance:", bal / LAMPORTS_PER_SOL, "SOL (endpoint:", endpoint, ")");
          process.exit(0);
        } catch (err) {
          console.warn(`Airdrop attempt ${attempt} failed on ${endpoint}:`, err?.message || err);
          if (attempt < MAX_RETRIES) {
            const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
            console.log(`Waiting ${backoff}ms before retry...`);
            await sleep(backoff);
            continue;
          }
        }
      }

      console.log(`All attempts failed for endpoint ${endpoint}. Trying next endpoint...`);
    }

    console.error("Airdrop failed on all endpoints. Options:");
    console.error("- Try again later (devnet faucet sometimes has issues).");
    console.error("- Use a different RPC provider (QuickNode, Alchemy, Helius) and add its devnet URL to endpoints.");
    console.error("- Use Docker solana image to airdrop or fund from another wallet.");
    process.exit(1);
  } catch (err) {
    console.error("Airdrop script error:", err.message || err);
    process.exit(1);
  }
})();