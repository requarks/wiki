package main

import (
	"fmt"
	"log"
	"os/exec"

	"github.com/blang/semver"
	"github.com/fatih/color"
	"github.com/pbnjay/memory"
)

const nodejsSemverRange = ">=8.11.4 <11.0.0"
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
		panic(fmt.Errorf(color.RedString("Error: Installed Node.js version %s is not supported! %s\n"), nodeVersion, nodejsSemverRange))
	}

	fmt.Printf(color.GreenString("✔")+" Node.js %s: OK\n", nodeVersion.String())

	return true
}

// CheckRAM checks if system total RAM meets requirements
func CheckRAM() bool {
	var totalRAM = memory.TotalMemory() / 1024 / 1024
	if totalRAM < ramMin {
		panic(fmt.Errorf(color.RedString("Error: System does not meet RAM requirements. %s MB minimum.\n"), ramMin))
	}

	fmt.Printf(color.GreenString("✔")+" Total System RAM %d MB: OK\n", totalRAM)

	return true
}

// CheckNetworkAccess checks if download server can be reached
func CheckNetworkAccess() bool {
	// TODO
	return true
}
