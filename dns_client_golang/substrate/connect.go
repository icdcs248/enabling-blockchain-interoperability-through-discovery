package substrate

import (
	"fmt"
	"math/big"
	"strings"
	"sync"

	gsrpc "github.com/centrifuge/go-substrate-rpc-client/v4"
	"github.com/centrifuge/go-substrate-rpc-client/v4/signature"
	"github.com/centrifuge/go-substrate-rpc-client/v4/types"
	"github.com/centrifuge/go-substrate-rpc-client/v4/types/codec"
)

type DomainRes struct {
	Creator    types.AccountID
	ChainSpec  types.Text
	Maintainer types.Text
	Available  bool
}

type TldRes struct {
	ChainSpec types.Text
}

type SubstrateConnector struct {
	rootSpecUrl       string
	apiCache          map[string]*gsrpc.SubstrateAPI
	rootBootnodeIndex int
	tldBootnodeIndex  map[string]int
	metadataRegistry  map[string]*types.Metadata
	useCache          bool
	m                 sync.RWMutex
	rootLock          sync.RWMutex
	tldLocks          map[string]*sync.RWMutex
}

var (
	rootSpecCache *ChainSpecRes = nil
	tldSpecCache  *ChainSpecRes = nil
)

func NewSubstrateConnector(useCache bool) *SubstrateConnector {
	return &SubstrateConnector{
		rootSpecUrl:       ROOT_SPEC_URL,
		apiCache:          make(map[string]*gsrpc.SubstrateAPI),
		rootBootnodeIndex: 0,
		tldBootnodeIndex:  make(map[string]int),
		metadataRegistry:  make(map[string]*types.Metadata),
		useCache:          useCache,
		tldLocks:          make(map[string]*sync.RWMutex),
	}
}

func (c *SubstrateConnector) ResolveDomain(domain string, eval bool) (string, error) {
	_, tld, err := parseDomain(domain)
	if err != nil {
		return "", err
	}
	tldSpecUrl, err := c.resolveTldSpec(tld, eval)
	if err != nil {
		return "", err
	}
	targetSpecUrl, err := c.resolveTargetSpec(tldSpecUrl, domain, eval)
	if err != nil {
		return "", err
	}
	return targetSpecUrl, nil
}

func (c *SubstrateConnector) resolveTldSpec(tld string, eval bool) (string, error) {
	var (
		rootSpec *ChainSpecRes
		tldRes   *TldRes
		err      error
	)

	if !eval || rootSpecCache == nil {
		rootSpec, err = FetchChainSpecJSON(ROOT_SPEC_URL)
		rootSpecCache = rootSpec
	} else {
		rootSpec = rootSpecCache
	}

	if err != nil {
		return "", err
	}

	tldRes, err = c.getTldFromRoot(*rootSpec, tld)

	if err != nil {
		return "", err
	}
	return string(tldRes.ChainSpec), nil
}

func (c *SubstrateConnector) resolveTargetSpec(tldSpecUrl, domain string, eval bool) (string, error) {

	var (
		tldSpec *ChainSpecRes
		err     error
	)

	if !eval || tldSpecCache == nil {
		tldSpec, err = FetchChainSpecJSON(tldSpecUrl)
		tldSpecCache = tldSpec
	} else {
		tldSpec = tldSpecCache
	}

	if err != nil {
		return "", err
	}
	domainRes, err := c.getTargetFromTld(*tldSpec, domain)
	if err != nil {
		return "", err
	}
	return string(domainRes.ChainSpec), nil
}

func (c *SubstrateConnector) getSubstrateApi(spec ChainSpecRes, bootNodeIndex int) (*gsrpc.SubstrateAPI, error) {
	c.m.Lock()
	cacheKey := fmt.Sprintf("%s-%d", spec.Id, bootNodeIndex)
	api, ok := c.apiCache[cacheKey]
	if !c.useCache || !ok {
		bootNode := spec.BootNodes[bootNodeIndex]
		connAddr := getConnectionAddress(bootNode)
		newApi, err := gsrpc.NewSubstrateAPI(connAddr)
		if err != nil {
			return nil, fmt.Errorf("failed to create Substrate API: %v", err)
		}
		api = newApi

		if c.useCache {
			// Cache the API instance
			c.apiCache[cacheKey] = api
			fmt.Printf("Created new Substrate API for %s\n", cacheKey)
		}
	}
	c.m.Unlock()
	return api, nil
}

func (c *SubstrateConnector) RegisterAsset(domain, assetName string, nonce uint32, results chan string) uint32 {

	var (
		rootSpec *ChainSpecRes
		err      error
	)

	if rootSpecCache == nil {
		rootSpec, err = FetchChainSpecJSON(ROOT_SPEC_URL)

		if err != nil {
			panic(err)
		}

		rootSpecCache = rootSpec
	} else {
		rootSpec = rootSpecCache
	}
	registerAssetTx := "AssetDiscoveryModule.register_asset_for_domain"

	c.rootLock.RLock()
	api, err := c.getSubstrateApi(*rootSpec, c.rootBootnodeIndex)
	c.rootLock.RUnlock()
	c.rootLock.Lock()
	c.rootBootnodeIndex = (c.rootBootnodeIndex + 1) % len(rootSpec.BootNodes)
	c.rootLock.Unlock()

	if err != nil {
		panic(err)
	}

	var meta *types.Metadata

	if _, ok := c.metadataRegistry[rootSpec.Id]; !ok {
		meta, err = api.RPC.State.GetMetadataLatest()
		if err != nil {
			panic(err)
		}
		c.metadataRegistry[rootSpec.Id] = meta
	} else {
		meta = c.metadataRegistry[rootSpec.Id]
	}

	// fmt.Printf("Meta: %#v\n", meta)

	call, err := types.NewCall(meta, registerAssetTx, domain, assetName)
	if err != nil {
		panic(err)
	}

	tx := types.NewExtrinsic(call)

	genesisHash, err := api.RPC.Chain.GetBlockHash(0)
	if err != nil {
		panic(err)
	}

	rv, err := api.RPC.State.GetRuntimeVersionLatest()
	if err != nil {
		panic(err)
	}

	// Get the nonce for Alice
	key, err := types.CreateStorageKey(meta, "System", "Account", signature.TestKeyringPairAlice.PublicKey)
	if err != nil {
		panic(err)
	}

	var accountInfo types.AccountInfo
	ok, err := api.RPC.State.GetStorageLatest(key, &accountInfo)
	if err != nil || !ok {
		panic(err)
	}

	if nonce == 0 {
		nonce = uint32(accountInfo.Nonce)
	}

	o := types.SignatureOptions{
		BlockHash:          genesisHash,
		Era:                types.ExtrinsicEra{IsMortalEra: false},
		GenesisHash:        genesisHash,
		Nonce:              types.NewUCompactFromUInt(uint64(nonce)),
		SpecVersion:        rv.SpecVersion,
		Tip:                types.NewUCompactFromUInt(0),
		TransactionVersion: rv.TransactionVersion,
	}

	// Sign the transaction using Alice's default account
	err = tx.Sign(signature.TestKeyringPairAlice, o)
	if err != nil {
		panic(err)
	}

	var startBlockNumber types.U256

	sub, err := api.RPC.Author.SubmitAndWatchExtrinsic(tx)
	if err != nil {
		panic(err)
	}
	defer sub.Unsubscribe()

	for {
		status := <-sub.Chan()
		if status.IsInBlock {
			fmt.Printf("Completed at block hash: %#x\n", status.AsInBlock)

			block, err := api.RPC.Chain.GetBlock(status.AsInBlock)
			if err != nil {
				panic(err)
			}
			startBlock := block.Block.Header.Number
			startBlockNumber = types.NewU256(*new(big.Int).SetUint64(uint64(startBlock)))
			if assetName == "asset-1" {
				break
			}
			res := fmt.Sprintf("%s,%s", assetName, startBlockNumber)
			results <- res
			fmt.Printf("Completed at block number: %d\n", startBlockNumber)
			break
		}
	}

	if !c.useCache {
		api.Client.Close()
	}

	return nonce
}

func (c *SubstrateConnector) ListenForEvents(results chan string, assetEval bool, totalRuns int) {
	var (
		rootSpec *ChainSpecRes
		err      error
	)

	if rootSpecCache == nil {
		rootSpec, err = FetchChainSpecJSON(ROOT_SPEC_URL)

		if err != nil {
			panic(err)
		}

		rootSpecCache = rootSpec
	} else {
		rootSpec = rootSpecCache
	}

	c.rootLock.RLock()
	api, err := c.getSubstrateApi(*rootSpec, c.rootBootnodeIndex)
	c.rootLock.RUnlock()

	if err != nil {
		panic(err)
	}

	var meta *types.Metadata

	if _, ok := c.metadataRegistry[rootSpec.Id]; !ok {
		meta, err = api.RPC.State.GetMetadataLatest()
		if err != nil {
			panic(err)
		}
		c.metadataRegistry[rootSpec.Id] = meta
	} else {
		meta = c.metadataRegistry[rootSpec.Id]
	}

	type EventDomainValidationRequested struct {
		Phase     types.Phase
		Domain    string
		AssetHash [32]byte
		Timestamp string
		Topics    []types.Hash
	}

	type EventAssetRegisteredForDomain struct {
		Phase        types.Phase
		AssetHash    string
		Domain       string
		CurrentBlock types.U256
		Topics       []types.Hash
	}

	type EventExpiredRequestsRemoved struct {
		Phase  types.Phase
		Topics []types.Hash
	}

	type EventAssetProviderRevoked struct {
		Phase  types.Phase
		Domain string
		Topics []types.Hash
	}

	type EventRecords struct {
		types.EventRecords
		AssetDiscoveryModule_DomainValidationRequested []EventDomainValidationRequested
		AssetDiscoveryModule_AssetRegisteredForDomain  []EventAssetRegisteredForDomain
		AssetDiscoveryModule_ExpiredRequestsRemoved    []EventExpiredRequestsRemoved
		AssetDiscoveryModule_AssetProviderRevoked      []EventAssetProviderRevoked
	}

	key, err := types.CreateStorageKey(meta, "System", "Events", nil)

	if err != nil {
		fmt.Printf("Error creating storage key: %v\n", err)
		panic(err)
	}

	sub, err := api.RPC.State.SubscribeStorageRaw([]types.StorageKey{key})
	if err != nil {
		panic(err)
	}
	defer sub.Unsubscribe()

	fmt.Println("WE ARE SUBSCRIBING NOW")

	for {
		set := <-sub.Chan()
		for _, chng := range set.Changes {
			fmt.Println("Storage change detected")

			// Decode the event records
			events := EventRecords{}
			err = types.EventRecordsRaw(chng.StorageData).DecodeEventRecords(meta, &events)
			if err != nil {
				fmt.Printf("Error decoding event records: %v\n", err)
			}

			for _, e := range events.AssetDiscoveryModule_DomainValidationRequested {
				fmt.Printf("\tAsset Requested %v\n\n", e)
			}

			for _, e := range events.AssetDiscoveryModule_AssetRegisteredForDomain {
				fmt.Printf("\tAsset Registered %v\n\n", e)
				if assetEval {
					blockNumber := e.CurrentBlock
					if e.AssetHash == "asset-1" {
						continue
					}
					res := fmt.Sprintf("%s,%s", e.AssetHash[5:], blockNumber.Int)
					results <- res
				}
			}

			for _, e := range events.AssetDiscoveryModule_AssetProviderRevoked {
				fmt.Printf("\tAsset Provider Revoked %v\n\n", e)
			}
		}
	}
}

func (c *SubstrateConnector) getTldFromRoot(rootSpec ChainSpecRes, keyParam string) (*TldRes, error) {
	rootModule := "RootDNSModule"
	tldMap := "TLDMap"

	c.rootLock.RLock()
	key, err := c.getStorageKey(rootSpec, c.rootBootnodeIndex, rootModule, tldMap, keyParam)
	c.rootLock.RUnlock()

	if err != nil {
		return nil, err
	}

	c.rootLock.RLock()
	api, err := c.getSubstrateApi(rootSpec, c.rootBootnodeIndex)
	c.rootLock.RUnlock()
	c.rootLock.Lock()
	c.rootBootnodeIndex = (c.rootBootnodeIndex + 1) % len(rootSpec.BootNodes)
	c.rootLock.Unlock()

	if err != nil {
		return nil, err
	}

	var tldRes TldRes
	ok, err := api.RPC.State.GetStorageLatest(key, &tldRes)
	if err != nil || !ok {
		panic(err)
	}

	if !c.useCache {
		api.Client.Close()
	}

	return &tldRes, nil
}

func (c *SubstrateConnector) getTargetFromTld(tldSpec ChainSpecRes, keyParam string) (*DomainRes, error) {
	tldModule := "TldModule"
	domainMap := "DomainMap"

	if _, ok := c.tldLocks[tldSpec.Id]; !ok {
		c.tldLocks[tldSpec.Id] = &sync.RWMutex{}
	}

	c.tldLocks[tldSpec.Id].Lock()
	if _, ok := c.tldBootnodeIndex[tldSpec.Id]; !ok {
		c.tldBootnodeIndex[tldSpec.Id] = 0
	}
	c.tldLocks[tldSpec.Id].Unlock()

	c.tldLocks[tldSpec.Id].RLock()
	key, err := c.getStorageKey(tldSpec, c.tldBootnodeIndex[tldSpec.Id], tldModule, domainMap, keyParam)
	c.tldLocks[tldSpec.Id].RUnlock()

	if err != nil {
		return nil, err
	}

	c.tldLocks[tldSpec.Id].RLock()
	api, err := c.getSubstrateApi(tldSpec, c.tldBootnodeIndex[tldSpec.Id])
	c.tldLocks[tldSpec.Id].RUnlock()
	c.tldLocks[tldSpec.Id].Lock()
	c.tldBootnodeIndex[tldSpec.Id] = (c.tldBootnodeIndex[tldSpec.Id] + 1) % len(tldSpec.BootNodes)
	c.tldLocks[tldSpec.Id].Unlock()

	if err != nil {
		return nil, err
	}

	var domainRes DomainRes
	ok, err := api.RPC.State.GetStorageLatest(key, &domainRes)
	if err != nil || !ok {
		panic(err)
	}

	if !c.useCache {
		api.Client.Close()
	}

	return &domainRes, nil
}

func (c *SubstrateConnector) getStorageKey(spec ChainSpecRes, bootNodeIndex int, module, keyMap, keyParam string) (types.StorageKey, error) {
	api, err := c.getSubstrateApi(spec, bootNodeIndex)
	if err != nil {
		return nil, err
	}

	var meta *types.Metadata

	if _, ok := c.metadataRegistry[spec.Id]; !ok {
		meta, err = api.RPC.State.GetMetadataLatest()
		if err != nil {
			panic(err)
		}
		c.metadataRegistry[spec.Id] = meta
	} else {
		meta = c.metadataRegistry[spec.Id]
	}

	if !c.useCache {
		api.Client.Close()
	}

	encodedTld, err := codec.Encode([]byte(keyParam))
	if err != nil {
		return nil, err
	}

	key, err := types.CreateStorageKey(meta, module, keyMap, encodedTld)
	if err != nil {
		return nil, err
	}
	return key, nil
}

func parseDomain(domain string) (string, string, error) {
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("error parsing domain %s", domain)
	}
	return parts[0], parts[1], nil
}

func getConnectionAddress(bootNodeMPAddr string) string {
	addrSpl := strings.Split(bootNodeMPAddr, "/")

	addr := addrSpl[2]
	port := addrSpl[4]

	connAddr := fmt.Sprintf("ws://%s:%s", addr, port)

	return connAddr
}
