import { ethers } from 'ethers';
import { sendTx } from '../utils/sendTx';

export const name = 'Argon';
export const token = 'ZRX';
export const isOutputAvailable = false;

export const chainToId = {
	ethereum: '1',
	// bsc: '56',
	// polygon: '137',
	// optimism: '10',
	// arbitrum: '42161',
	// avax: '43114',
	// fantom: '250',
	// celo: '42220',
	base: '8453'
};

export const isSignatureNeededForSwap = true;

export function approvalAddress() {
	return '0x000000000022d473030f116ddee9f6b43ac78ba3';
}

const nativeToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const feeCollectorAddress = '0x9Ab6164976514F1178E2BB4219DA8700c9D96E9A';

export async function getQuote(chain: string, from: string, to: string, amount: string, extra) {
	// amount should include decimals

	const tokenFrom = from === ethers.constants.AddressZero ? nativeToken : from;
	const tokenTo = to === ethers.constants.AddressZero ? nativeToken : to;

	if (extra.amountOut && extra.amountOut !== '0') {
		throw new Error('Invalid query params');
	}
	const amountParam = `sellAmount=${amount}`;

	// only expects integer
	const slippage = (extra.slippage * 100) | 0;

	const data = await fetch(
		`https://api.0x.org/swap/permit2/quote?chainId=${chainToId[chain]}&buyToken=${tokenTo}&${amountParam}&sellToken=${tokenFrom}&slippageBps=${slippage}&taker=${extra.userAddress}&tradeSurplusRecipient=${feeCollectorAddress}`,
		{
			headers: {
				'0x-api-key': process.env.OX_API_KEY
			}
		}
	).then(async (r) => {
		if (r.status !== 200) {
			throw new Error('Failed to fetch');
		}

		const data = await r.json();

		return data;
	});

	if (
		data.permit2 !== null &&
		data.permit2.eip712.domain.verifyingContract.toLowerCase() !== approvalAddress().toLowerCase()
	) {
		throw new Error(`Approval address does not match`);
	}

	return {
		amountReturned: data?.buyAmount || 0,
		amountIn: data?.sellAmount || 0,
		tokenApprovalAddress: data.permit2 ? approvalAddress() : null,
		estimatedGas: data.transaction.gas,
		rawQuote: { ...data, gasLimit: data.transaction.gas },
		logo: 'https://www.gitbook.com/cdn-cgi/image/width=40,height=40,fit=contain,dpr=2,format=auto/https%3A%2F%2F1690203644-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FKX9pG8rH3DbKDOvV7di7%252Ficon%252F1nKfBhLbPxd2KuXchHET%252F0x%2520logo.png%3Falt%3Dmedia%26token%3D25a85a3e-7f72-47ea-a8b2-e28c0d24074b'
	};
}

const MAGIC_CALLDATA_STRING = 'f'.repeat(130); // used when signing the eip712 message

export async function signatureForSwap({ rawQuote, signTypedDataAsync }) {
	const signature = await signTypedDataAsync({
		domain: rawQuote.permit2.eip712.domain,
		types: rawQuote.permit2.eip712.types,
		primaryType: rawQuote.permit2.eip712.primaryType,
		value: rawQuote.permit2.eip712.message
	});

	return signature;
}

export async function swap({ signer, rawQuote, chain, signature }) {
	const fromAddress = await signer.getAddress();

	const tx = await sendTx(signer, chain, {
		from: fromAddress,
		to: rawQuote.transaction.to,
		// signature not needed for unwrapping native tokens
		data: signature
			? rawQuote.transaction.data.replace(MAGIC_CALLDATA_STRING, signature.slice(2))
			: rawQuote.transaction.data,
		value: rawQuote.transaction.value,
		...(chain === 'optimism' && { gasLimit: rawQuote.gasLimit })
	});

	return tx;
}

export const getTxData = ({ rawQuote }) => rawQuote?.transaction?.data;

export const getTx = ({ rawQuote }) => ({
	to: rawQuote.transaction.to,
	data: rawQuote.transaction.data,
	value: rawQuote.transaction.value
});
