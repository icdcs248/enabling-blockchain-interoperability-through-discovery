package main

import (
	"fmt"
	"os/exec"
	"strconv"
	"time"

	"github.com/khalidzahra/bcdnseval/benchmark"
)

const (
	COM_TLD_SPECS  = "http://json_server:3000/json/com_tldSpec.json"
	EXAMPLE_SPECS  = "http://json_server:3000/json/exampleSpec.json"
	WHATEVER_SPECS = "http://json_server:3000/json/whateverSpec.json"
)

var (
	FILLER_TLDS        = [...]string{"org", "net", "gov", "edu"}
	FILLER_TARGETS     = [...]string{"test", "example2", "example3", "domain", "domain1", "domain2", "domain3", "google", "facebook", "twitter", "instagram", "linkedin", "youtube", "reddit", "tiktok", "snapchat", "whatsapp", "telegram", "signal", "discord", "slack", "microsoft", "apple", "amazon", "netflix", "spotify", "uber", "lyft", "airbnb", "expedia", "tripadvisor", "booking", "priceline", "kayak"}
	DNS_CONFIGURATIONS = [...]ArchOptions{
		{
			tlds:         1,
			networks:     2,
			validators:   6,
			normal_nodes: 0,
		},
		{
			tlds:         1,
			networks:     2,
			validators:   8,
			normal_nodes: 0,
		},
		{
			tlds:         1,
			networks:     2,
			validators:   10,
			normal_nodes: 0,
		},
		{
			tlds:         1,
			networks:     2,
			validators:   20,
			normal_nodes: 0,
		},
		{
			tlds:         1,
			networks:     2,
			validators:   32,
			normal_nodes: 0,
		},
	}
	currentConfig *ArchOptions
)

type ArchOptions struct {
	tlds         int
	networks     int
	validators   int
	normal_nodes int
}

type ArchOption func(*ArchOptions)

func withOptions(options *ArchOptions) ArchOption {
	return func(o *ArchOptions) {
		o.tlds = options.tlds
		o.networks = options.networks
		o.validators = options.validators
		o.normal_nodes = options.normal_nodes
	}
}

func withDefault() ArchOption {
	return func(o *ArchOptions) {
		o.tlds = 1
		o.networks = 2
		o.validators = 2
		o.normal_nodes = 2
	}
}

func launchArch(setters ...ArchOption) {
	o := &ArchOptions{}

	for _, setter := range setters {
		setter(o)
	}

	cmd := exec.Command("./launch_dns_arch.sh",
		"--tld",
		strconv.Itoa(o.tlds),
		"--target",
		strconv.Itoa(o.networks),
		"--validators",
		strconv.Itoa(o.validators),
		"--nodes",
		strconv.Itoa(o.normal_nodes))
	cmd.Dir = "../node_template"
	out, _ := cmd.Output()
	fmt.Printf("launch_dns_arch.sh: %s\n", string(out))
	fmt.Println("Successfully launched DNS architecture.")
}

func cleanArch() {
	cmd := exec.Command("./dns_arch_cleanup.sh")
	cmd.Dir = "../node_template"
	out, _ := cmd.Output()
	fmt.Printf("dns_arch_cleanup.sh: %s\n", string(out))
	fmt.Println("Successfully cleaned up DNS architecture.")
}

func setupDNSInfo() {
	fmt.Printf("Setting up DNS information...")
	cmd := exec.Command("npm",
		"run",
		"register",
		"--",
		"--tld",
		"com",
		COM_TLD_SPECS,
		"//Alice")
	cmd.Dir = "../dns_client"
	comTldOut, _ := cmd.Output()
	fmt.Printf("Registered COM TLD: %s\n", string(comTldOut))

	for _, tld := range FILLER_TLDS {
		fillerCmd := exec.Command("npm",
			"run",
			"register",
			"--",
			"--tld",
			tld,
			COM_TLD_SPECS, // Can use any value since this is filler information
			"//Alice")
		fillerCmd.Dir = "../dns_client"
		fillerCmdOut, _ := fillerCmd.Output()
		fmt.Printf("Registered %s TLD: %s\n", tld, string(fillerCmdOut))
	}

	time.Sleep(time.Millisecond * 10000) // Wait 10 seconds for ledger to stabilize

	cmd = exec.Command("npm",
		"run",
		"register",
		"--",
		"--domain",
		"example.com",
		EXAMPLE_SPECS,
		"//Alice")
	cmd.Dir = "../dns_client"
	exampleOut, _ := cmd.Output()
	fmt.Printf("Registered example network: %s\n", string(exampleOut))

	cmd = exec.Command("npm",
		"run",
		"register",
		"--",
		"--domain",
		"whatever.com",
		WHATEVER_SPECS,
		"//Alice")
	whateverOut, _ := cmd.Output()
	cmd.Dir = "../dns_client"
	fmt.Printf("Registered whatever network: %s\n", string(whateverOut))

	for _, target := range FILLER_TARGETS {
		fillerCmd := exec.Command("npm",
			"run",
			"register",
			"--",
			"--domain",
			target,
			EXAMPLE_SPECS, // Can use any value since this is filler information
			"//Alice")
		fillerCmd.Dir = "../dns_client"
		fillerCmdOut, _ := fillerCmd.Output()
		fmt.Printf("Registered %s network: %s\n", target, string(fillerCmdOut))
	}

	time.Sleep(time.Millisecond * 10000) // Wait 10 seconds for ledger to stabilize
}

func runTests(useCache bool) {
	var (
		REQUESTS_PER_SECOND = [...]int{
			100,
			200,
			300,
			400,
			500,
			1000,
		}
		TOTAL_REQUESTS = 10000
	)

	for _, rps := range REQUESTS_PER_SECOND {
		fmt.Printf("Running test with %d requests per second...\n", rps)
		testName := fmt.Sprintf("%dtld_%dtarg_%dv_%dn_%drps",
			currentConfig.tlds,
			currentConfig.networks,
			currentConfig.validators,
			currentConfig.normal_nodes,
			rps)
		benchmark.LaunchBenchmark(TOTAL_REQUESTS, rps, fmt.Sprintf("%s.csv", testName), useCache)
	}
}

func main() {
	for _, o := range DNS_CONFIGURATIONS {
		fmt.Printf("Launching architecture using settings:\n %+v\n", o)
		currentConfig = &o
		// for i := 0; i < 2; i++ {
			launchArch(withOptions(&o))
			setupDNSInfo()
			runTests(true)
			cleanArch()
		// }
	}
}
