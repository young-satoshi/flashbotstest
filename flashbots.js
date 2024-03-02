require('dotenv').config();
const ethers = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

const main = async () => {
  const provider = new ethers.JsonRpcProvider('https://goerli.infura.io/v3/611ec671cefc41c6b762b18b57d85e57');
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, ethers.Wallet.createRandom());

  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY_DEPLOYER, provider);
  const buyers = [
    new ethers.Wallet(process.env.PRIVATE_KEY_BUYER1, provider),
    new ethers.Wallet(process.env.PRIVATE_KEY_BUYER2, provider),
    new ethers.Wallet(process.env.PRIVATE_KEY_BUYER3, provider),
    new ethers.Wallet(process.env.PRIVATE_KEY_BUYER4, provider)
  ];

  // Define your token contract interface and address
  const tokenContractABI = [
    "function setTrading(bool _tradingOpen)",
    "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline)"
    // Add other necessary ABI items here
  ];
  const tokenContractAddress = '0x2Af102FFaA712Fe48aBbaF3536ebe05E1dF7d628'; // Replace with your token's contract address
  const tokenContract = new ethers.Contract(tokenContractAddress, tokenContractABI, provider);

  // Define the Uniswap contract interface and address
  const uniswapABI = [
    "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline)"
  ];
  const uniswapAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Replace with the actual Uniswap contract address
  const uniswapContract = new ethers.Contract(uniswapAddress, uniswapABI, provider);

  const tokenAddress = '0x2Af102FFaA712Fe48aBbaF3536ebe05E1dF7d628'; // The address of the token you want to swap to
  const wethAddress = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'; // The WETH token address

  // Define transactions array
  const transactions = [];

  // Transaction to open trading
  const setTradingTx = {
    to: tokenContractAddress,
    data: tokenContract.interface.encodeFunctionData('setTrading', [true]),
    gasLimit: ethers.utils.hexlify(100000), // Estimate or increase the gas limit as needed
    gasPrice: ethers.utils.parseUnits('150', 'gwei') // Set appropriate gas price
  };
  transactions.push({ signer: deployer, transaction: setTradingTx });

  // Add buy transactions for each buyer
  buyers.forEach(buyer => {
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
    const amountOut = ethers.utils.parseUnits('1000000', 9); // The exact amount of tokens you want to buy
    const path = [wethAddress, tokenAddress]; // Path for swapping (ETH -> YourToken)
    const value = ethers.utils.parseEther('1'); // The max amount of ETH you are willing to swap

    const tx = {
      to: uniswapAddress,
      value: value, // This ETH will be swapped to tokens
      data: uniswapContract.interface.encodeFunctionData('swapETHForExactTokens', [
        amountOut,
        path,
        buyer.address,
        deadline
      ]),
      gasLimit: ethers.utils.hexlify(300000), // Adjust based on estimated gas for the swap
      gasPrice: ethers.utils.parseUnits('150', 'gwei') // Adjust based on current gas prices
    };
    transactions.push({ signer: buyer, transaction: tx });
  });

  // Submit the bundle
  const block = await provider.getBlockNumber();
  const bundle = transactions.map(tx => ({
    signer: tx.signer,
    transaction: tx.transaction
  }));

  const signedBundle = await flashbotsProvider.signBundle(bundle);
  await flashbotsProvider.sendBundle(signedBundle, { targetBlockNumber: block + 1 });
  console.log('Bundle submitted, awaiting inclusion...');
};


main().catch(console.error);
