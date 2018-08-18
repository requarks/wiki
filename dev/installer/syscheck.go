package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/blang/semver"
	"github.com/pbnjay/memory"
	"github.com/ttacon/chalk"
)

const nodejsSemverRange = ">=8.11.3 <10.0.0"
const ramMin = 768

// CheckNodeJs checks if Node.js is installed and has minimal supported version
func CheckNodeJs() bool {
	cmd := exec.Command("node", "-v")
	cmdOutput, err := cmd.CombinedOutput()
	if err != nil {
		log.Fatal(err)
	}

	validRange := semver.MustParseRange(nodejsSemverRange)
	nodeVersion, err := semver.ParseTolerant(string(cmdOutput[:]))
	if !validRange(nodeVersion) {
		fmt.Printf(chalk.Red.Color("Error: Installed Node.js version is not supported! %s"), nodejsSemverRange)
		os.Exit(1)
	}

	fmt.Printf(chalk.Green.Color("✔")+" Node.js %s: OK\n", nodeVersion.String())

	return true
}

// CheckRAM checks if system total RAM meets requirements
func CheckRAM() bool {
	var totalRAM = memory.TotalMemory() / 1024 / 1024
	if totalRAM < ramMin {
		fmt.Printf(chalk.Red.Color("Error: System does not meet RAM requirements. %s MB minimum."), ramMin)
		os.Exit(1)
	}

	fmt.Printf(chalk.Green.Color("✔")+" Total System RAM %d MB: OK\n", totalRAM)

	return true
}

// CheckNetworkAccess checks if download server can be reached
func CheckNetworkAccess() bool {
	// TODO
	return true
}
