package main

import (
	"fmt"
	"runtime"

	"github.com/bugsnag/bugsnag-go"
	"github.com/fatih/color"
	"gopkg.in/AlecAivazis/survey.v1"
)

var qs = []*survey.Question{
	{
		Name: "location",
		Prompt: &survey.Input{
			Message: "Where do you want to install Wiki.js?",
			Default: "./wiki",
		},
		Validate: survey.Required,
	},
	{
		Name: "dbtype",
		Prompt: &survey.Select{
			Message: "Select a DB Driver:",
			Options: []string{"MariabDB", "MS SQL Server", "MySQL", "PostgreSQL", "SQLite"},
			Default: "PostgreSQL",
		},
	},
	{
		Name: "port",
		Prompt: &survey.Input{
			Message: "Server Port:",
			Default: "3000",
		},
	},
}

func main() {
	bugsnag.Configure(bugsnag.Configuration{
		APIKey:       "37770b3b08864599fd47c4edba5aa656",
		ReleaseStage: "dev",
	})

	bold := color.New(color.FgWhite).Add(color.Bold)

	logo := `
  __    __ _ _    _    _
 / / /\ \ (_) | _(_)  (_)___
 \ \/  \/ / | |/ / |  | / __|
  \  /\  /| |   <| |_ | \__ \
   \/  \/ |_|_|\_\_(_)/ |___/
                    |__/
  `
	color.Yellow(logo)

	bold.Println("\nInstaller for Wiki.js 2.x")
	fmt.Printf("%s-%s\n\n", runtime.GOOS, runtime.GOARCH)

	// Check system requirements

	bold.Println("Verifying system requirements...")
	CheckNodeJs()
	CheckRAM()
	fmt.Println()

	// the answers will be written to this struct
	answers := struct {
		Location string
		DBType   string `survey:"dbtype"`
		Port     int
	}{}

	// perform the questions
	err := survey.Ask(qs, &answers)
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	fmt.Printf("%s chose %d.", answers.Location, answers.Port)

	// Download archives...

	bold.Println("\nDownloading packages...")

	// uiprogress.Start()
	// bar := uiprogress.AddBar(100)

	// bar.AppendCompleted()
	// bar.PrependElapsed()

	// for bar.Incr() {
	// 	time.Sleep(time.Millisecond * 20)
	// }

	finish := `
  >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  |                                                   |
  |    Open http://localhost:3000/ in your browser    |
  |    to complete the installation!                  |
  |                                                   |
  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  `
	color.Yellow("\n\n" + finish)

	fmt.Println("Press any key to continue.")
	fmt.Scanln()
}
