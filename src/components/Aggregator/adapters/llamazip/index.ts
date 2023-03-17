import { BigNumber, ethers } from 'ethers';
import { providers } from '../../rpcs';
import { sendTx } from '../../utils/sendTx';
import { encode } from './encode';
import { normalizeTokens, pairs } from './pairs';

export const name = 'LlamaZip';
export const token = 'none';

export const chainToId = {
	optimism: '0x6f9d14Cf4A06Dd9C70766Bd161cf8d4387683E1b',
	arbitrum: '0x5279EBC4e5BA9eA09F19ADE49F2Bc98339aeA4d7'
};

// https://docs.uniswap.org/contracts/v3/reference/deployments
const quoter = {
	optimism: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
	arbitrum: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
};

const weth = {
	optimism: '0x4200000000000000000000000000000000000006',
	arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};

function normalize(token: string, weth: string) {
	return (token === ethers.constants.AddressZero ? weth : token).toLowerCase();
}

// https://docs.uniswap.org/sdk/v3/guides/quoting
export async function getQuote(chain: string, from: string, to: string, amount: string, extra: any) {
	if (to.toLowerCase() === weth[chain].toLowerCase()) {
		return {}; // We don't support swaps to WETH
	}
	const provider = providers[chain];
	const quoterContract = new ethers.Contract(
		quoter[chain],
		[
			'function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
		],
		provider
	);

	const tokenFrom = normalize(from, weth[chain]);
	const tokenTo = normalize(to, weth[chain]);

	const token0isTokenIn = BigNumber.from(tokenFrom).lt(tokenTo);

	const pair = pairs[chain as keyof typeof pairs].find(
		({ name }) => name === normalizeTokens(tokenFrom, tokenTo).join('-')
	);

	if (pair === undefined) {
		return {};
	}

	const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
		tokenFrom,
		tokenTo,
		pair.fee,
		amount,
		0
	);

	const inputIsETH = from === ethers.constants.AddressZero;
	const calldata = encode(
		pair.pairId,
		token0isTokenIn,
		quotedAmountOut,
		extra.slippage ?? '0.5',
		inputIsETH,
		false,
		amount
	);
	if (calldata.length > 256 / 4 + 2) {
		return {}; // LlamaZip doesn't support calldata that's bigger than one EVM word
	}

	return {
		amountReturned: quotedAmountOut.toString(),
		estimatedGas: (200e3).toString(), // random approximation
		rawQuote: {
			tx: {
				to: pair.router,
				data: calldata,
				...(inputIsETH ? { value: amount } : {})
			}
		},
		tokenApprovalAddress: pair.router,
		logo: 'https://raw.githubusercontent.com/DefiLlama/memes/master/bussin.jpg'
	};
}

export async function swap({ signer, rawQuote, chain }) {
	const fromAddress = await signer.getAddress();

	const tx = await sendTx(signer, chain, {
		from: fromAddress,
		to: rawQuote.tx.to,
		data: rawQuote.tx.data,
		value: rawQuote.tx.value
	});
	return tx;
}

export const getTxData = ({ rawQuote }) => rawQuote?.tx?.data;

export const getTx = ({ rawQuote }) => rawQuote?.tx;
