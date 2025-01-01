package benchmark

import (
	"encoding/csv"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"sync"
)

func readCSV(filePath string) (map[int]int, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	executionTimes := make(map[int]int)

	for i := 1; i < len(records); i++ {
		run, err := strconv.Atoi(records[i][0])
		if err != nil {
			return nil, err
		}
		time, err := strconv.Atoi(records[i][1])
		if err != nil {
			return nil, err
		}
		executionTimes[run] = time
	}

	return executionTimes, nil
}

func subtractCSV(file1, file2, outputFile string) error {
	times1, err := readCSV(file1)
	if err != nil {
		return err
	}

	times2, err := readCSV(file2)
	if err != nil {
		return err
	}

	result := make(map[int]int)

	for run, time1 := range times1 {
		if time2, ok := times2[run]; ok {
			diff := time1 - time2
			result[run] = diff
		}
	}

	err = writeCSV(result, outputFile)
	if err != nil {
		return err
	}

	return nil
}

func writeCSV(data map[int]int, filename string) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	err = writer.Write([]string{"Run", "Time Difference (ms)"})
	if err != nil {
		return err
	}

	for run, diff := range data {
		err = writer.Write([]string{strconv.Itoa(run), strconv.Itoa(diff)})
		if err != nil {
			return err
		}
	}

	return nil
}

func LaunchBenchmark(totalRequests, rps int, outFile string, useCache bool) {
	if useCache {
		cmd := exec.Command("./dns_client",
			"--eval",
			"--runs",
			fmt.Sprintf("%d", totalRequests),
			"--rps",
			fmt.Sprintf("%d", rps),
			"--useCache",
			"--outFile",
			outFile[:len(outFile)-4]+"_cache.csv")
		cmd.Dir = "../dns_client_golang"

		output, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("Error: %s\n", err)
		}

		fmt.Println(string(output))
	} else {
		cmd := exec.Command("./dns_client",
			"--eval",
			"--runs",
			fmt.Sprintf("%d", totalRequests),
			"--rps",
			fmt.Sprintf("%d", rps),
			"--outFile",
			outFile)
		cmd.Dir = "../dns_client_golang"

		output, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("Error: %s\n", err)
		}

		fmt.Println(string(output))
	}

	if rps <= 300 {
		listenFile := outFile[:len(outFile)-4] + "_assetEval_listen.csv"
		assetFile := outFile[:len(outFile)-4] + "_assetEval.csv"

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()

			cmd := exec.Command("./dns_client",
				"--listen",
				"--runs",
				fmt.Sprintf("%d", 500), // keep at 500, no need for a higher number
				"--outFile",
				listenFile)
			cmd.Dir = "../dns_client_golang"

			output, err := cmd.CombinedOutput()
			if err != nil {
				fmt.Printf("Error: %s\n", err)
			}

			fmt.Println(string(output))
		}()

		go func() {
			defer wg.Done()

			cmd := exec.Command("./dns_client",
				"--assetEval",
				"--runs",
				fmt.Sprintf("%d", 500), // keep at 500, no need for a higher number
				"--rps",
				fmt.Sprintf("%d", rps),
				"--outFile",
				assetFile)
			cmd.Dir = "../dns_client_golang"

			output, err := cmd.CombinedOutput()
			if err != nil {
				fmt.Printf("Error: %s\n", err)
			}

			fmt.Println(string(output))
		}()

		wg.Wait()

		subtractCSV("../dns_client_golang/"+listenFile, "../dns_client_golang/"+assetFile, outFile[:len(outFile)-4]+"_assetEval_diff.csv")
	}
}
