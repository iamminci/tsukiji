// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");

const network = "rinkeby"; // or mainnet

// initialize web3 provider; converge on using one of ethers and web3 later
const Web3 = require("web3");
const providerUri = `https://eth-${network}.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}/`;
const provider = new Web3.providers.HttpProvider(providerUri);
const web3 = new Web3(provider);
const admin = require("firebase-admin");

if (process.env.FIREBASE_PRIVATE_KEY && admin.apps.length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

// sample mainnet address: 0xF56A5dd899dD95F39f5E01488BDdCbaBa64B8d45
// sample testnet address: 0x17e547d79C04D01E49fEa275Cf32ba06554f9dF7
// whitelisted ERC721 contracts
const erc721Contracts: Record<string, Record<string, string>> = {
  mainnet: {
    azuki: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    bayc: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    mayc: "0x60E4d786628Fea6478F785A6d7e704777c86a7c6",
    moonbirds: "0x23581767a106ae21c074b2276D25e5C3e136a68b",
    doodles: "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e",
    // 'punks': '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB', // punks might be too complicated to deal with for this hackathon
  },
  rinkeby: {
    sznouns1: "0xc3A949D2798e13cE845bDd21Bf639A28548faf30",
    sznouns2: "0x63f9e083a76e396c45b5f6fce41e6a91ea0a1400",
  },
};
// whitelisted ERC20 contracts
const erc20Contracts: Record<string, Record<string, string>> = {
  mainnet: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    // 'steth': '',
    // 'eth': ''
  },
  rinkeby: {
    // put something here later
  },
};
// whitelisted ERC1155 contracts

/* #### ROUTE HANDLER #### */
// This handler supports GET requests.
// It expects an associated address for which to return relevant orders.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method === "GET") {
    // fetch all orders
    const { addressParam } = req.query;

    if (Array.isArray(addressParam)) {
      res
        .status(400)
        .json(
          `Invalid param: expecting single string, got array: ${addressParam}`
        );
    }

    const address = addressParam as string;

    if (!ethers.utils.isAddress(address)) {
      res.status(400).json(`Invalid address: ${address}`);
    }

    const tokens = await fetchRelevantTokens(address);

    // Inefficient query but it's all g
    const snapshot = await db.collection("orders").get();
    let relevantOrders: any = [];

    // Loop through all existing orders and wallet's items (clearly O(m * n))
    // This jawn could be optimized by just throwing stuff into a hash map to go to O(m + n) but meh rn
    // Type-agnostic for for-loops, but you can't break/continue out of forEach loops.
    // Iterate through the wallet's tokens first because if there are none, we save a query.
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < snapshot.docs.length; j++) {
        let docId = snapshot.docs[i].id;
        let doc = snapshot.docs[i].data();

        // The offer[] and consideration[] arrays are stored weirdly in firestore.
        // They're saved as objects, so all we want is the values of those objects (concatenated).
        let docItems: any = Object.values(doc["parameters"]["offer"]).concat(
          Object.values(doc["parameters"]["consideration"])
        );

        for (let k = 0; k < docItems.length; k++) {
          if (tokens[i].contractAddress === docItems[k].token) {
            // we got a match!
            relevantOrders.push({
              _id: docId,
              ...doc,
            });

            // if there's a match, no need to continue going through other tokens since we know
            // the current order (document) is relevant
            break;
          }
        }
      }
    }

    res.status(200).json(relevantOrders);
  } else {
    res.status(400).json("Unable to handle request");
  }
}

// fetchRelevantOrders will return all relevant (whitelisted) tokens belonging to an address.
// Optimizations: batch calls; use indexers to prevent having to make live queries.
const fetchRelevantTokens = async (address: string) => {
  const tokens = [];

  for (const erc20 in erc20Contracts[network]) {
    const contract: string = erc20Contracts[network][erc20];
    if (contract.length == 0) {
      continue;
    }

    const balanceObj = await getERC20TokenBalance(contract, address);
    if (parseInt(balanceObj["balance"], 10) !== 0) tokens.push(balanceObj);
  }

  for (const erc721 in erc721Contracts[network]) {
    const contract: string = erc721Contracts[network][erc721];
    if (contract.length == 0) {
      continue;
    }

    const balanceObj = await getERC721Tokens(contract, address);
    if (parseInt(balanceObj["balance"], 10) !== 0) tokens.push(balanceObj);
  }

  return tokens;
};

/* #### HELPER FUNCTIONS BELOW #### */

// returns ERC20 token balance given token address + wallet address
const getERC20TokenBalance = async (
  contractAddress: string,
  walletAddress: string
): Promise<any> => {
  // Get ERC20 Token contract instance
  let contract = new web3.eth.Contract(minERC20ABI, contractAddress);

  let balance = 0;

  await contract.methods
    .balanceOf(walletAddress)
    .call()
    .then((bal: any) => {
      balance = bal;
    });

  let decimals = 0;

  await contract.methods
    .decimals()
    .call()
    .then((dec: any) => {
      decimals = dec;
    });

  let symbol = "";

  await contract.methods
    .symbol()
    .call()
    .then((sym: any) => {
      symbol = sym;
    });

  return {
    type: "ERC20",
    contractAddress,
    balance,
    wholeBalance: (balance / 10 ** decimals).toString(),
    decimals,
    symbol,
  };
};

// returns ERC20 token balance given token address + wallet address
const getERC721Tokens = async (
  contractAddress: string,
  walletAddress: string
): Promise<any> => {
  // Get ERC721 Token contract instance
  let contract = new web3.eth.Contract(minERC721ABI, contractAddress);

  // would be cool to batch these requests
  // should be able to handle larger numbers as well
  let balance = 0;

  await contract.methods
    .balanceOf(walletAddress)
    .call()
    .then((bal: any) => {
      balance = bal;
    });

  let symbol = "";

  await contract.methods
    .symbol()
    .call()
    .then((sym: any) => {
      symbol = sym;
    });

  console.log(`balance: ${balance}, symbol: ${symbol}`);

  let tokenIds = [];

  for (let i = 0; i < balance; i++) {
    let tokenId = await contract.methods
      .tokenOfOwnerByIndex(walletAddress, i)
      .call()
      .then((id: any) => {
        return id;
      });

    tokenIds.push(tokenId);
  }

  return {
    type: "ERC721",
    contractAddress,
    balance: balance,
    tokens: tokenIds,
    symbol,
  };
};

// The minimum ABI to get ERC20 Token details
let minERC20ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // decimals
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  // symbol
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
];

// The minimum ABI to get ERC20 Token details
let minERC721ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // symbol
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  // tokenOfOwnerByIndex
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    type: "function",
  },
];
