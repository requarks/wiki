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

var finish = `
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
|                                                   |
|    Open http://localhost:3000/ in your browser    |
|    to complete the installation!                  |
|                                                   |
<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
`

func main() {
	fmt.Println(chalk.Yellow.Color(logo))
	fmt.Println(chalk.Bold.TextStyle("Installer for Wiki.js 2.x"))
	fmt.Printf("%s-%s\n\n", runtime.GOOS, runtime.GOARCH)

	// Check system requirements

	fmt.Println(chalk.Bold.TextStyle("Verifying system requirements..."))
	CheckNodeJs()
	CheckRAM()
	fmt.Println(chalk.Bold.TextStyle("\nSetup"))

	// Prompt for build to install

	promptBuild := promptui.Select{
		Label: "Select Build to install",
		Items: []string{"Stable", "Dev"},
		Templates: &promptui.SelectTemplates{
			Help:     " ",
			Selected: chalk.Green.Color("✔") + " Build: {{ . }}",
		},
	}

	_, _, err := promptBuild.Run()

	if err != nil {
		fmt.Printf("Prompt failed %v\n", err)
		return
	}

	// Choose database driver

	promptDB := promptui.Select{
		Label: "Select database driver",
		Items: []string{"MariaDB", "MySQL", "MS SQL Server", "PostgreSQL", "SQLite"},
		Templates: &promptui.SelectTemplates{
			Help:     " ",
			Selected: chalk.Green.Color("✔") + " Database Driver: {{ . }}",
		},
		Size: 10,
	}

	_, _, err = promptDB.Run()

	// Port

	promptPort := promptui.Prompt{
		Label:   "Port",
		Default: "3000",
		Templates: &promptui.PromptTemplates{
			Success: chalk.Green.Color("✔") + " Port: {{ . }}",
		},
	}

	_, err = promptPort.Run()

	// Download archives...

	fmt.Println(chalk.Bold.TextStyle("\nDownloading packages..."))

	uiprogress.Start()
	bar := uiprogress.AddBar(100)

	bar.AppendCompleted()
	bar.PrependElapsed()

	for bar.Incr() {
		time.Sleep(time.Millisecond * 20)
	}

	fmt.Println("\n" + chalk.Yellow.Color(finish))
}
