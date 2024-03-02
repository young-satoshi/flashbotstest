require('dotenv').config();

function customParseEther(value) {
    return customParseUnits(value, 18); // Since parseEther is essentially parseUnits with 18 decimals for ether
}

// Define the customHexlify function here
function customHexlify(value) {
    if (typeof value === 'number') {
        // Ensure the number is positive and round it as hexlify deals with integers
        value = Math.max(0, Math.floor(value));
        // Convert to a hexadecimal string and add '0x' prefix
        return '0x' + value.toString(16);
    }
    throw new Error('customHexlify currently only supports numbers.');
}
function customParseUnits(value, decimals = 18) {
    // This is a simplified version and might not handle all edge cases.
    // Ensure value is a string to handle big numbers safely.
    value = value.toString();
    const parts = value.split('.');
    let [whole, fraction] = parts;

    // If there's no fractional part, make it an empty string.
    if (!fraction) fraction = '';
    if (fraction.length > decimals) {
        // Cut off the string to the maximum number of decimals.
        fraction = fraction.slice(0, decimals);
    } else {
        // Pad the fraction with zeros to the required number of decimals.
        while (fraction.length < decimals) {
            fraction += '0';
        }
    }

    // Combine the whole part and the fractional part.
    return whole + fraction;
}

// Now you can safely use customHexlify in your script
console.log("Testing customHexlify:", customHexlify(100000));

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

    // Log hexlified gas limit for setTradingTx using customHexlify
    console.log("Custom Hexlified gas limit for setTradingTx:", customHexlify(100000));
    const setTradingTx = {
        to: tokenContractAddress,
        data: tokenContract.interface.encodeFunctionData('setTrading', [true]),
        gasLimit: customHexlify(100000),
        gasPrice: customParseUnits('150', 9) // Here we're assuming 'gwei' so 9 decimals
    };
    transactions.push({ signer: deployer, transaction: setTradingTx });


    // Add buy transactions for each buyer using customHexlify
    buyers.forEach(buyer => {
        const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
        const amountOut = customParseUnits('1000000', 18); // Adjust based on your needs
        const path = [wethAddress, tokenAddress];
        const value = customParseEther('1');
    
        const tx = {
            to: uniswapAddress,
            value: value,
            data: uniswapContract.interface.encodeFunctionData('swapETHForExactTokens', [
                customParseUnits('1000000', 18), // Assuming 'wei' as unit, so 18 decimals
                path,
                buyer.address,
                deadline
            ]),
            gasLimit: customHexlify(200000),
            gasPrice: customParseUnits('150', 9) // Assuming 'gwei' as unit
        };
        transactions.push({ signer: buyer, transaction: tx });
    });

  // Submit the bundle
  const block = await provider.getBlockNumber();
    const signedBundle = await flashbotsProvider.signBundle(
        transactions.map(tx => ({signer: tx.signer, transaction: tx.transaction}))
    );
    const sendResult = await flashbotsProvider.sendBundle(signedBundle, { targetBlockNumber: block + 1 });
    console.log('Bundle submitted, awaiting inclusion...', sendResult);
};

main().catch(console.error);