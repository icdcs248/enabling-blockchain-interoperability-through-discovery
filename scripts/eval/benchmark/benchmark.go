package benchmark

import (
	"fmt"
	"os/exec"
)

func LaunchBenchmark(totalRequests, rps int, outFile string) {
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
		return
	}

	fmt.Println(string(output))
}
