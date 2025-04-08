const express = require('express');
const { ethers, JsonRpcProvider } = require('ethers');
const Moralis = require('moralis').default;
const { EvmChain } = require('@moralisweb3/common-evm-utils');
const app = express();

app.use(express.json());

// Inisialisasi Moralis
Moralis.start({
  apiKey: process.env.MORALIS_API_KEY,
});

// Log environment variables
console.log('BASE_RPC_URL:', process.env.BASE_RPC_URL);
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');

let provider, wallet, contract;
try {
  provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contractAddress = '0xddafccf625344039848feffc61939931f17b550a'; // Konfirmasi kontrak Anda
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

// Fungsi untuk mendapatkan semua token ID yang dimiliki wallet
async function getOwnedTokenIds(walletAddress, contractAddress) {
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
    console.error('Error fetching token IDs:', error.message);
    return [];
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
    const tokenIds = await getOwnedTokenIds(wallet.address, contractAddress);
    if (tokenIds.length === 0) {
      throw new Error('No tokens available to transfer');
    }

    // Pilih token ID acak dari daftar (atau logika lain sesuai kebutuhan)
    const tokenId = tokenIds[Math.floor(Math.random() * tokenIds.length)];
    console.log('Selected Token ID:', tokenId);

    // Gunakan alamat tes untuk recipient (ganti dengan alamat Anda sendiri untuk tes)
    const recipientWalletAddress = '0xYourTestWalletAddressHere'; // Ganti dengan alamat valid
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