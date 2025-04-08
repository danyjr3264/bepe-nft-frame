const express = require('express');
const { ethers } = require('ethers');
const app = express();

app.use(express.json());

// Konfigurasi Ethereum (gunakan environment variables di Vercel)
const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY', provider);
const contractAddress = '0xddafccf625344039848feffc61939931f17b550a';
const contractABI = [
  "function transferFrom(address from, address to, uint256 tokenId) public",
  "function balanceOf(address owner) public view returns (uint256)"
];
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

const claimedFIDs = new Set(); // Ganti dengan database di produksi

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
  const { untrustedData } = req.body;
  const fid = untrustedData?.fid || 'unknown';

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
    const walletAddress = untrustedData?.address || '0x...'; // Ganti dengan logika untuk mendapatkan wallet
    const tx = await contract.transferFrom(wallet.address, walletAddress, 1); // Sesuaikan tokenId
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
    console.error(error);
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

module.exports = app; // Export untuk Vercel