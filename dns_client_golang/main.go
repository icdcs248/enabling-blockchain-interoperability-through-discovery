package main

import (
	"flag"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/khalidzahra/dns_client/eval"
	"github.com/khalidzahra/dns_client/substrate"
)

func fetchSingleSpec(domain string, idx int, connector *substrate.SubstrateConnector, eval bool) (int, int64) {
	start := time.Now()
	target, err := connector.ResolveDomain(domain, eval)
	if err != nil {
		panic(err)
	}
	duration := time.Since(start).Milliseconds() // For evaluation
	fmt.Println("================================================================")
	fmt.Println("		FOUND TARGET CHAIN SPEC")
	fmt.Println("================================================================")
	fmt.Println(target)
	return idx, duration
}

func fetchSpec(domain string, runs, runsPerSecond int, outFile string, evalFlag, useCache bool) {
	resultChan := make(chan *eval.EvalResult)
	var resultArr []*eval.EvalResult

	connector := substrate.NewSubstrateConnector(useCache)

	eval.RunFuncPerSecond(func(currentRun int, wg *sync.WaitGroup) {
		idx, time := fetchSingleSpec(domain, currentRun, connector, evalFlag)
		wg.Done()
		resultChan <- &eval.EvalResult{Idx: idx, Time: time}
	}, runs, runsPerSecond)

	if evalFlag {
		for i := 0; i < runs; i++ {
			select {
			case result := <-resultChan:
				resultArr = append(resultArr, result)
			}
		}

		eval.WriteToCSV(outFile, resultArr)
	}

}

func registerAssets(domain, outFile string, rps, totalRuns int) {
	connector := substrate.NewSubstrateConnector(true)
	resultsChan := make(chan string, 1000)
	nonce := connector.RegisterAsset(domain, fmt.Sprintf("asset%d", -1), 0, resultsChan)
	fmt.Printf("Initial nonce: %d\n", nonce)
	eval.RunFuncPerSecond(func(currentRun int, wg *sync.WaitGroup) {
		connector.RegisterAsset(domain, fmt.Sprintf("asset%d", currentRun), nonce+uint32(currentRun)+1, resultsChan)
		wg.Done()
	}, totalRuns, rps)

	var resultArr []*eval.EvalResult
	for i := 0; i < totalRuns; i++ {
		result := <-resultsChan
		resultParsed := strings.Split(result, ",")
		idx, _ := strconv.Atoi(resultParsed[0])
		time, _ := strconv.ParseInt(resultParsed[1], 10, 64)
		resultArr = append(resultArr, &eval.EvalResult{Idx: idx, Time: time})
	}

	eval.WriteToCSV(outFile, resultArr)
}

func listenToEvents(totalRuns int, outFile string, useCache bool) {
	connector := substrate.NewSubstrateConnector(useCache)
	resultsChan := make(chan string, 1000)
	go connector.ListenForEvents(resultsChan, true, 1000)

	var resultArr []*eval.EvalResult

	timeout := 30 * time.Second
listenerLoop:
	for i := 0; i < totalRuns; i++ {
		select {
		case result := <-resultsChan:
			resultParsed := strings.Split(result, ",")
			idx, _ := strconv.Atoi(resultParsed[0])
			timeVal, _ := strconv.ParseInt(resultParsed[1], 10, 64)
			resultArr = append(resultArr, &eval.EvalResult{Idx: idx, Time: timeVal})
		case <-time.After(timeout):
			fmt.Println("Timeout: No more events received for 30 seconds.")
			break listenerLoop
		}
	}

	eval.WriteToCSV(outFile, resultArr)
}

func main() {
	// Command line args
	var eval, assetEval, listen, useCache bool
	var runs, runsPerSecond int
	var domain, outFile string
	flag.StringVar(&domain, "domain", "example.com", "Domain to fetch chainspec for")
	flag.StringVar(&outFile, "outFile", "eval.csv", "Name of file to output eval results")
	flag.BoolVar(&eval, "eval", false, "Evaluate performance by running multiple times")
	flag.BoolVar(&assetEval, "assetEval", false, "Evaluate asset registration performance by running multiple times")
	flag.BoolVar(&listen, "listen", false, "Listen to events emitted by the chain")
	flag.BoolVar(&useCache, "useCache", false, "Use caching for interacting with the chain")
	flag.IntVar(&runs, "runs", 1, "Number of runs for evaluation")
	flag.IntVar(&runsPerSecond, "rps", 1, "Number of runs per second for evaluation")
	flag.Parse()

	if assetEval {
		registerAssets(domain, outFile, runsPerSecond, runs)
	} else if listen {
		listenToEvents(runs, outFile, useCache)
	} else {
		fetchSpec(domain, runs, runsPerSecond, outFile, eval, useCache)
	}
}
