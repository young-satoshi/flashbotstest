require('dotenv').config();
const ethers = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

const main = async () => {
    let provider, flashbotsProvider;
    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const tokenAddress = '0x3Ad3b3Ca3f979BC5C50950861a460ff34615b8a0'; 
    const uniswapAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    try {
        provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/611ec671cefc41c6b762b18b57d85e57');
        flashbotsProvider = await FlashbotsBundleProvider.create(
            provider,
            ethers.Wallet.createRandom(),
            'https://relay.flashbots.net',
            'mainnet' // Add this line
        );
    } catch (error) {
        console.error('Failed to create providers:', error.message);
        return;
    }

    let deployer, tokenContract, uniswapContract;
    try {
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_DEPLOYER, provider);
        
        const tokenContractABI = [
            "function setTrading(bool _tradingOpen)",
            "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline)"
        ];
        tokenContract = new ethers.Contract(tokenAddress, tokenContractABI, provider);

        const uniswapABI = [
            "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline)"
        ];
        uniswapContract = new ethers.Contract(uniswapAddress, uniswapABI, provider);
    } catch (error) {
        console.error('Failed to set up contracts or deployer:', error.message);
        return;
    }

    const buyers = [
        new ethers.Wallet(process.env.PRIVATE_KEY_BUYER1, provider),
        new ethers.Wallet(process.env.PRIVATE_KEY_BUYER2, provider),
        new ethers.Wallet(process.env.PRIVATE_KEY_BUYER3, provider)
    ];

    const transactions = [];
    const gasPrice = BigInt("150") * BigInt("1000000000"); // 150 gwei

    try {
        const setTradingTx = await deployer.signTransaction({
            chainId: 1,
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData('setTrading', [true]),
            gasLimit: 100000,
            gasPrice: gasPrice.toString(),
            nonce: await provider.getTransactionCount(deployer.address, 'latest')
        });
        transactions.push(setTradingTx);

        for (const buyer of buyers) {
            const deadline = Math.floor(Date.now() / 1000) + 1800;
            const amountOut = BigInt("1000000") * BigInt("10") ** BigInt("18");
            const path = [wethAddress, tokenAddress];
            const value = ethers.parseEther('1');

            const tx = await buyer.signTransaction({
                chainId: 1,
                to: uniswapAddress,
                value: value.toString(),
                data: uniswapContract.interface.encodeFunctionData('swapETHForExactTokens', [
                    amountOut.toString(),
                    path,
                    buyer.address,
                    deadline
                ]),
                gasLimit: 200000,
                gasPrice: gasPrice.toString(),
                nonce: await provider.getTransactionCount(buyer.address, 'latest')
            });
            transactions.push(tx);
        }
    } catch (error) {
        console.error('Error preparing transactions:', error.message);
        return;
    }

    try {
        const block = await provider.getBlockNumber();
        const sendResult = await flashbotsProvider.sendRawBundle(transactions, block + 1);
        console.log('Bundle submitted, awaiting inclusion:', sendResult);
        
        // Wait for the bundle to be included or dropped
        const waitResult = await sendResult.wait();
        if (waitResult === 0) {
            console.log('Bundle included in a block');
        } else {
            console.error('Bundle was not included in a block');
        }

    } catch (error) {
        console.error('Error signing or sending the bundle:', error.message);
    }
};

main().catch(error => console.error('Unhandled error:', error.message));
