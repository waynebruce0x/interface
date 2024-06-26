import { debounce } from 'lodash';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
	Box,
	Flex,
	Text,
	Input,
	RangeSlider,
	RangeSliderTrack,
	RangeSliderFilledTrack,
	RangeSliderThumb,
	Button,
	useColorModeValue
} from '@chakra-ui/react';
import MultiSelect from '../MultiSelect';
import { chainIconUrl } from '../Aggregator/nativeTokens';
import { useRouter } from 'next/router';
import { createFilter } from 'react-select';
import { MenuList } from './MenuList';

const createIndex = (data, key) => {
	return data.reduce((acc, item) => {
		const value = item[key];
		if (!acc[value]) acc[value] = [];
		acc[value].push(item);
		return acc;
	}, {});
};

const useAdvancedFilter = (initialData) => {
	const indexes = useMemo(
		() => ({
			chain: createIndex(initialData, 'chain'),
			project: createIndex(initialData, 'project')
		}),
		[initialData]
	);

	return useCallback(
		(query) => {
			const { chains = '', projects = '', search = '', apyFrom = 0, apyTo = 200, tvlFrom = '', tvlTo = '' } = query;

			let filteredData = initialData;

			if (chains) {
				const chainArray = chains.split(',');
				filteredData = chainArray.flatMap((chain) => indexes.chain[chain] || []);
			}

			if (projects) {
				const projectArray = projects.split(',');
				filteredData = filteredData.filter((item) => projectArray.includes(item.project));
			}

			if (search) {
				const searchLower = search.toLowerCase();
				filteredData = filteredData.filter((item) => item.symbol.toLowerCase().includes(searchLower));
			}

			filteredData = filteredData.filter((item) => item.apyMean30d >= +apyFrom && item.apyMean30d <= +apyTo);

			if (tvlFrom || tvlTo) {
				filteredData = filteredData.filter(
					(item) => (!tvlFrom || item.tvlUsd >= +tvlFrom) && (!tvlTo || item.tvlUsd <= +tvlTo)
				);
			}

			return filteredData;
		},
		[initialData, indexes]
	);
};

const Filters = ({ setData, initialData, config }) => {
	const router = useRouter();
	const advancedFilter = useAdvancedFilter(initialData);

	let { chains = '', projects = '', search = '', apyFrom = 0, apyTo = 200, tvlFrom = '', tvlTo = '' } = router.query;

	const [displayedApyRange, setDisplayedApyRange] = useState([+apyFrom, +apyTo]);

	const allChains = useMemo(() => Array.from(new Set(initialData.map((item) => item.chain))), [initialData]);
	const chainOptions = allChains.map((chain: string) => ({
		value: chain,
		label: chain,
		logoURI: chainIconUrl(chain?.toLowerCase())
	}));

	const allProjects = useMemo(() => Object.keys(config), [config]);
	const projectOptions = useMemo(
		() =>
			allProjects.map((project) => ({
				value: project,
				label: config?.[project]?.name,
				logoURI: `https://icons.llamao.fi/icons/protocols/${project}?w=48&h=48`
			})),
		[allProjects, config]
	);

	const allTokens = useMemo(
		() => Array.from(new Set(initialData.map((item) => item.symbol))).filter((s: string) => s.split('-')?.length === 1),
		[initialData]
	);
	const tokensOptions = allTokens.map((token) => ({
		value: token,
		label: token
	}));

	const handleFilterChanges = useCallback(
		debounce((query) => {
			const filteredData = advancedFilter(query);
			setData(filteredData);
		}, 500),
		[advancedFilter, setData]
	);

	useEffect(() => {
		handleFilterChanges({ chains, projects, search, apyFrom, apyTo, tvlFrom, tvlTo });
	}, [chains, projects, search, apyFrom, apyTo, tvlFrom, tvlTo, handleFilterChanges]);

	const handleQueryChange = useCallback(
		(value, key) => {
			let query;
			if (key === 'apy') {
				const [newApyFrom, newApyTo] = value;
				query = { ...router.query, apyFrom: newApyFrom, apyTo: newApyTo };
			} else {
				query = { ...router.query, [key]: value };
			}

			router.push({ query }, undefined, { shallow: true });
			handleFilterChanges(query);
		},
		[handleFilterChanges, router]
	);

	const handleChainChange = (options) => {
		handleQueryChange(options?.value, 'chains');
	};

	const handleProjectChange = (options) => {
		handleQueryChange(options?.value, 'projects');
	};

	const handleSymbolSearch = useCallback((value) => {
		handleQueryChange(value, 'search');
	}, []);

	const handleTvlFromChange = useCallback(
		(e) => {
			const value = e.target.value;
			handleQueryChange(value, 'tvlFrom');
		},
		[handleQueryChange]
	);

	const handleTvlToChange = useCallback(
		(e) => {
			const value = e.target.value;
			handleQueryChange(value, 'tvlTo');
		},
		[handleQueryChange]
	);

	const changeApyRange = useCallback((values) => {
		handleQueryChange(values, 'apy');
	}, []);

	const handleApyRangeChange = useCallback(
		(values) => {
			setDisplayedApyRange(values);
		},
		[setDisplayedApyRange, handleQueryChange]
	);

	const handleResetFilters = () => {
		setDisplayedApyRange([0, 200]);

		router.push({ query: { tab: 'yields' } }, undefined, { shallow: true });
	};
	const thumbColor = useColorModeValue('gray.300', 'gray.600');

	return (
		<Flex direction="column" gap={3} minWidth={'260px'} padding={'20px'}>
			<Box>
				<Text fontWeight="bold" mb={4} fontSize={16}>
					Filters
				</Text>
				<Box mb={2}>
					<Text fontWeight="medium" mb={2}>
						Symbol
					</Text>
					<MultiSelect
						itemCount={allTokens.length}
						options={tokensOptions}
						value={
							search
								? {
										label: search,
										value: search
								  }
								: null
						}
						onChange={(value: { value: string }) => handleSymbolSearch(value?.value)}
						placeholder="Search symbols..."
						cacheOptions
						defaultOptions
						filterOption={createFilter({ ignoreAccents: false })}
						components={{ MenuList }}
						isClearable
					/>
				</Box>
				<Box>
					<Text fontWeight="medium" mb={2}>
						Chain
					</Text>
					<MultiSelect
						options={chainOptions}
						value={chains ? { value: chains, label: chains, logoURI: chainIconUrl(chains) } : null}
						onChange={handleChainChange}
						placeholder="Select chains..."
						isClearable
						components={{ MenuList }}
					/>
				</Box>
			</Box>

			<Box>
				<Text fontWeight="medium" mb={2}>
					Project
				</Text>
				<MultiSelect
					options={projectOptions}
					value={
						projects
							? {
									value: projects,
									label: config?.[projects as string]?.name,
									logoURI: `https://icons.llamao.fi/icons/protocols/${projects}?w=48&h=48`
							  }
							: null
					}
					onChange={handleProjectChange}
					placeholder="Select projects..."
					itemCount={allProjects.length}
					cacheOptions
					defaultOptions
					filterOption={createFilter({ ignoreAccents: false })}
					components={{ MenuList }}
					isClearable
				/>
			</Box>

			<Box>
				<Text fontWeight="medium" mb={2}>
					TVL USD
				</Text>
				<Flex gap={2}>
					<Input
						placeholder="From"
						onChange={(e) => handleTvlFromChange(e)}
						bg="rgb(20, 22, 25)"
						borderColor="transparent"
						fontSize={'14px'}
						_focusVisible={{ outline: 'none' }}
						value={tvlFrom}
					/>
					<Input
						placeholder="To"
						onChange={(e) => handleTvlToChange(e)}
						bg="rgb(20, 22, 25)"
						borderColor="transparent"
						fontSize={'14px'}
						_focusVisible={{ outline: 'none' }}
						value={tvlTo}
					/>
				</Flex>
			</Box>

			<Box>
				<Text fontWeight="medium" mb={6}>
					APY
				</Text>
				<Flex justify="center">
					<Box width="240px">
						<RangeSlider
							// eslint-disable-next-line jsx-a11y/aria-proptypes
							aria-label={['min', 'max']}
							defaultValue={[0, 200]}
							value={[displayedApyRange[0], displayedApyRange[1]] as any}
							min={0}
							max={200}
							step={1}
							onChange={handleApyRangeChange}
							onChangeEnd={(values) => changeApyRange(values)}
						>
							<RangeSliderTrack>
								<RangeSliderFilledTrack />
							</RangeSliderTrack>
							<RangeSliderThumb
								index={0}
								bg={thumbColor}
								_focus={{ boxShadow: 'outline' }}
								_active={{ bg: 'gray.400' }}
							>
								<Text fontSize="sm" transform="translateY(-100%)">
									{displayedApyRange[0].toFixed()}%
								</Text>
							</RangeSliderThumb>
							<RangeSliderThumb
								index={1}
								bg={thumbColor}
								_focus={{ boxShadow: 'outline' }}
								_active={{ bg: 'gray.400' }}
							>
								<Text fontSize="sm" transform="translateY(-100%)">
									{displayedApyRange[1].toFixed()}%
								</Text>
							</RangeSliderThumb>
						</RangeSlider>
					</Box>
				</Flex>
			</Box>
			<Flex justify="flex-end">
				<Button size={'sm'} onClick={handleResetFilters}>
					Reset Filters
				</Button>
			</Flex>
		</Flex>
	);
};

export default Filters;
