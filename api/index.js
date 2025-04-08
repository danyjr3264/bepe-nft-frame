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
console.log('OWNER_FID:', process.env.OWNER_FID);
console.log('REQUIRED_CAST_HASH:', process.env.REQUIRED_CAST_HASH);

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
      if (attempt === maxRetries) return [];
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return [];
}

// Fungsi untuk mendapatkan wallet address dari FID
async function getWalletFromFid(fid) {
  try {
    const response = await axios.get(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { 'accept': 'application/json', 'api_key': process.env.NEYNAR_API_KEY },
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

// Fungsi untuk memeriksa apakah FID mengikuti OWNER_FID
async function checkFollowStatus(userFid) {
  try {
    const response = await axios.get(`https://api.neynar.com/v2/farcaster/following?fid=${userFid}&limit=1000`, {
      headers: { 'accept': 'application/json', 'api_key': process.env.NEYNAR_API_KEY },
    });
    console.log('Follow response:', response.data);
    const followingList = response.data.following || [];
    const isFollowing = followingList.some(follow => follow.target_fid === Number(process.env.OWNER_FID));
    console.log(`FID ${userFid} follows OWNER_FID ${process.env.OWNER_FID}:`, isFollowing);
    return isFollowing;
  } catch (error) {
    console.error('Error checking follow status:', error.message);
    return false;
  }
}

// Fungsi untuk memeriksa apakah FID telah like dan repost cast tertentu
async function checkLikeAndRepost(fid, castHash) {
  try {
    // Cek likes
    const likeResponse = await axios.get(`https://api.neynar.com/v2/farcaster/reactions/user?fid=${fid}&type=like&limit=1000`, {
      headers: { 'accept': 'application/json', 'api_key': process.env.NEYNAR_API_KEY },
    });
    const likeHashes = likeResponse.data.reactions.map(reaction => reaction.target_hash);
    console.log(`Like hashes for FID ${fid}:`, likeHashes);
    const hasLiked = likeHashes.includes(castHash);

    // Cek reposts
    const repostResponse = await axios.get(`https://api.neynar.com/v2/farcaster/reactions/user?fid=${fid}&type=recast&limit=1000`, {
      headers: { 'accept': 'application/json', 'api_key': process.env.NEYNAR_API_KEY },
    });
    const repostHashes = repostResponse.data.reactions.map(reaction => reaction.target_hash);
    console.log(`Repost hashes for FID ${fid}:`, repostHashes);
    const hasReposted = repostHashes.includes(castHash);

    console.log(`FID ${fid} liked cast ${castHash}:`, hasLiked);
    console.log(`FID ${fid} reposted cast ${castHash}:`, hasReposted);
    return { hasLiked, hasReposted };
  } catch (error) {
    console.error('Error checking like/repost:', error.message, error.response?.data);
    return { hasLiked: false, hasReposted: false };
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
    // Cek persyaratan Warpcast
    const isFollowing = await checkFollowStatus(fid);
    const { hasLiked, hasReposted } = await checkLikeAndRepost(fid, process.env.REQUIRED_CAST_HASH);

    if (!isFollowing || !hasLiked || !hasReposted) {
      let message = 'Please ';
      if (!isFollowing) message += 'follow me, ';
      if (!hasLiked) message += 'like, ';
      if (!hasReposted) message += 'repost ';
      message += 'my post first!';

      const frameHtml = `
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://blush-hidden-mongoose-258.mypinata.cloud/ipfs/bafybeicwokv4vlo52rtj4mffjrh3lkjjlccu5jp3rc6gvslzbbshjxkzoi" />
            <meta property="fc:frame:button:1" content="Try Again" />
            <meta property="fc:frame:button:1:action" content="post" />
            <meta property="fc:frame:button:1:target" content="https://bepe-nft-frame.vercel.app/claim" />
            <meta property="fc:frame:post_url" content="https://bepe-nft-frame.vercel.app/claim" />
          </head>
        </html>
      `;
      res.set('Content-Type', 'text/html');
      return res.send(frameHtml);
    }

    // Dapatkan daftar token ID yang dimiliki wallet Anda
    const tokenIds = await getOwnedTokenIds(wallet.address);
    if (tokenIds.length === 0) {
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