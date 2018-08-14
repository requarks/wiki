package main

import (
	"fmt"
	"runtime"
	"time"

	"github.com/gosuri/uiprogress"
	"github.com/manifoldco/promptui"
	"github.com/ttacon/chalk"
)

var logo = `
 __    __ _ _    _    _
/ / /\ \ (_) | _(_)  (_)___
\ \/  \/ / | |/ / |  | / __|
 \  /\  /| |   <| |_ | \__ \
  \/  \/ |_|_|\_\_(_)/ |___/
                   |__/
`

func main() {
	fmt.Println(chalk.Yellow.Color(logo))
	fmt.Println(chalk.Bold.TextStyle("Installer for Wiki.js 2.x"))
	fmt.Printf("for %s-%s\n\n", runtime.GOOS, runtime.GOARCH)

	// Prompt for build to install

	prompt := promptui.Select{
		Label: "Select Build to install",
		Items: []string{"Stable", "Dev"},
	}

	_, result, err := prompt.Run()

	if err != nil {
		fmt.Printf("Prompt failed %v\n", err)
		return
	}

	fmt.Printf("You choose %q\n", result)

	// Download archives...

	uiprogress.Start()
	bar := uiprogress.AddBar(100)

	bar.AppendCompleted()
	bar.PrependElapsed()

	for bar.Incr() {
		time.Sleep(time.Millisecond * 20)
	}
}
