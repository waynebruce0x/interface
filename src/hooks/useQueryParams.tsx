import { ethers } from 'ethers';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getAllChains } from '~/components/Aggregator/router';

const chains = getAllChains();

export function useQueryParams() {
	const router = useRouter();
	const { isConnected, chain: chainOnWallet } = useAccount();

	const { chain: chainOnURL, from: fromToken, to: toToken, ...query } = router.query;

	const chainName = typeof chainOnURL === 'string' ? chainOnURL.toLowerCase() : 'ethereum';
	const fromTokenAddress = typeof fromToken === 'string' ? fromToken.toLowerCase() : null;
	const toTokenAddress = typeof toToken === 'string' ? toToken.toLowerCase() : null;

	useEffect(() => {
		if (router.isReady && !chainOnURL) {
			const chain = chainOnWallet ? chains.find((c) => c.chainId === chainOnWallet.id) : null;

			// redirects to chain on wallet if supported
			if (isConnected && chainOnWallet && chain) {
				router.push(
					{
						pathname: '/',
						query: { ...query, chain: chain.value, from: ethers.constants.AddressZero }
					},
					undefined,
					{ shallow: true }
				);
			} else {
				// redirects to ethereum, when there is no chain query param in URl or if chain on wallet is not supported
				router.push(
					{
						pathname: '/',
						query: { ...query, chain: 'ethereum', from: ethers.constants.AddressZero }
					},
					undefined,
					{ shallow: true }
				);
			}
		}
	}, [chainOnURL, chainOnWallet, isConnected, router]);

	return { chainName, fromTokenAddress, toTokenAddress };
}
