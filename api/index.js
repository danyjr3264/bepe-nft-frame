const express = require('express');
const { ethers, JsonRpcProvider } = require('ethers');
const Moralis = require('moralis').default;
const { EvmChain } = require('@moralisweb3/common-evm-utils');
const axios = require('axios');
const app = express();

app.use(express.json());

// Inisialisasi Moralis
Moralis.start({
  apiKey: process.env.MORALIS_API_KEY,
});

// Log environment variables
console.log('BASE_RPC_URL:', process.env.BASE_RPC_URL);
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');
console.log('NEYNAR_API_KEY:', process.env.NEYNAR_API_KEY ? 'Set' : 'Not set');

const contractAddress = '0xddafccf625344039848feffc61939931f17b550a'; // Konfirmasi kontrak Anda

let provider, wallet, contract;
try {
  provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contractABI = [
    "function transferFrom(address from, address to, uint256 tokenId) public",
    "function balanceOf(address owner) public view returns (uint256)"
  ];
  contract = new ethers.Contract(contractAddress, contractABI, wallet);
  console.log('Contract initialized successfully');
  console.log('Wallet address (sender):', wallet.address);
} catch (error) {
  console.error('Error initializing Ethereum:', error.message);
}

const claimedFIDs = new Set();

// Fungsi untuk mendapatkan semua token ID yang dimiliki wallet dengan retry
async function getOwnedTokenIds(walletAddress) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const chain = EvmChain.BASE;
      const response = await Moralis.EvmApi.nft.getWalletNFTs({
        chain,
        address: walletAddress,
        tokenAddresses: [contractAddress],
      });
      const tokenIds = response.result.map(nft => nft.tokenId);
      console.log('Owned token IDs:', tokenIds);
      return tokenIds;
    } catch (error) {
      attempt++;
      console.error(`Error fetching token IDs (attempt ${attempt}/${maxRetries}):`, error.message);
      if (attempt === maxRetries) {
        console.error('Max retries reached, giving up');
        return [];
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Delay sebelum retry
    }
  }
  return [];
}

// Fungsi untuk mendapatkan wallet address dari FID menggunakan Neynar API
async function getWalletFromFid(fid) {
  try {
    const response = await axios.get(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        'accept': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY,
      },
    });
    const userData = response.data.users[0];
    const custodyAddress = userData?.custody_address;
    console.log('Custody address for FID', fid, ':', custodyAddress);
    return custodyAddress || null;
  } catch (error) {
    console.error('Error fetching wallet from FID:', error.message);
    return null;
  }
}

app.get('/', (req, res) => {
  const frameHtml = `
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeifmntnodfu4zcfcbhrtmweobaqrxljlgp6f7u3hwfmg632aopgtpa" />
        <meta property="fc:frame:button:1" content="Claim BEPE NFTs" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:target" content="https://bepe-nft-frame.vercel.app/claim" />
        <meta property="fc:frame:post_url" content="https://bepe-nft-frame.vercel.app/claim" />
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
  console.log('Request body:', req.body);

  if (!contract) {
    console.error('Contract not initialized');
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
  console.log('FID:', fid);

  if (!fid) {
    console.error('No FID provided');
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
    console.log('FID already claimed:', fid);
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
    // Dapatkan daftar token ID yang dimiliki wallet Anda
    const tokenIds = await getOwnedTokenIds(wallet.address);
    if (tokenIds.length === 0) {
      console.error('No tokens available or Moralis API failed');
      const frameHtml = `
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeif6xkzclyiopunq3y22hcapsu3oupbuzxc2qzejpp6we7iufkpuhq" />
            <meta property="fc:frame:button:1" content="Failed: Out of Stock" />
          </head>
        </html>
      `;
      res.set('Content-Type', 'text/html');
      return res.send(frameHtml);
    }

    // Pilih token ID acak dari daftar
    const tokenId = tokenIds[Math.floor(Math.random() * tokenIds.length)];
    console.log('Selected Token ID:', tokenId);

    // Dapatkan wallet address penerima dari FID
    const recipientWalletAddress = await getWalletFromFid(fid);
    if (!recipientWalletAddress) {
      throw new Error('Could not retrieve wallet address for FID');
    }

    console.log('Sender (your wallet):', wallet.address);
    console.log('Recipient:', recipientWalletAddress);

    const tx = await contract.transferFrom(wallet.address, recipientWalletAddress, tokenId);
    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed');

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