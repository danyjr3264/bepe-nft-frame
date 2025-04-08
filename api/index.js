const express = require('express');
const { ethers, JsonRpcProvider } = require('ethers'); // Impor JsonRpcProvider eksplisit
const app = express();

app.use(express.json());

// Log untuk debugging
console.log('BASE_RPC_URL:', process.env.BASE_RPC_URL);
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');

let provider, wallet, contract;
try {
  provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contractAddress = '0xddafccf625344039848feffc61939931f17b550a'; // Pastikan valid di Base
  const contractABI = [
    "function transferFrom(address from, address to, uint256 tokenId) public",
    "function balanceOf(address owner) public view returns (uint256)"
  ];
  contract = new ethers.Contract(contractAddress, contractABI, wallet);
} catch (error) {
  console.error('Error initializing Ethereum:', error.message);
}

const claimedFIDs = new Set();

app.get('/', (req, res) => {
  const frameHtml = `
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeifmntnodfu4zcfcbhrtmweobaqrxljlgp6f7u3hwfmg632aopgtpa" />
        <meta property="fc:frame:button:1" content="Claim BEPE NFTs" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:target" content="/claim" />
        <meta property="fc:frame:post_url" content="/claim" />
      </head>
      <body>
        <p>BEPE NFT Claim Frame</p>
      </body>
    </html>
  `;
  res.set('Content-Type', 'text/html');
  res.send(frameHtml);
});

app.post('/claim', async (req, res) => {
  if (!contract) {
    const frameHtml = `
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeif6xkzclyiopunq3y22hcapsu3oupbuzxc2qzejpp6we7iufkpuhq" />
          <meta property="fc:frame:button:1" content="Failed: Server Error" />
        </head>
      </html>
    `;
    return res.send(frameHtml);
  }

  const { untrustedData } = req.body;
  const fid = untrustedData?.fid;

  if (!fid) {
    const frameHtml = `
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeif6xkzclyiopunq3y22hcapsu3oupbuzxc2qzejpp6we7iufkpuhq" />
          <meta property="fc:frame:button:1" content="Failed: No FID" />
        </head>
      </html>
    `;
    res.set('Content-Type', 'text/html');
    return res.send(frameHtml);
  }

  if (claimedFIDs.has(fid)) {
    const frameHtml = `
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeig2xmgzhagqqkaku6pmeowbpsglesn4kjoutcq3q65lxcenoy32ya" />
          <meta property="fc:frame:button:1" content="Your FID has been Claimed" />
        </head>
      </html>
    `;
    res.set('Content-Type', 'text/html');
    return res.send(frameHtml);
  }

  try {
    const walletAddress = untrustedData?.address || '0x...'; // Placeholder
    const tx = await contract.transferFrom(wallet.address, walletAddress, 1);
    await tx.wait();

    claimedFIDs.add(fid);
    const frameHtml = `
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeiazfcqzxodyvukl444pdno5lav2wimp4dhp4cpupohwznywjlizue" />
          <meta property="fc:frame:button:1" content="Claimed" />
        </head>
      </html>
    `;
    res.set('Content-Type', 'text/html');
    res.send(frameHtml);
  } catch (error) {
    console.error('Claim error:', error.message);
    const frameHtml = `
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeif6xkzclyiopunq3y22hcapsu3oupbuzxc2qzejpp6we7iufkpuhq" />
          <meta property="fc:frame:button:1" content="Failed" />
        </head>
      </html>
    `;
    res.set('Content-Type', 'text/html');
    res.send(frameHtml);
  }
});

module.exports = app;