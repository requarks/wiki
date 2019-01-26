SHELL := /bin/bash

start: ## Start Wiki.js in production mode
	node wiki start

stop: ## Stop Wiki.js
	node wiki stop

restart: ## Restart Wiki.js
	node wiki restart

dev-up: ## Start Wiki.js in development mode
	node wiki dev

build: ## Build Wiki.js client assets
	webpack --profile --config dev/webpack/webpack.prod.js

watch: ## Watch client files and rebuild assets on changes
	webpack --config dev/webpack/webpack.dev.js

test: ## Run code linting tests
	eslint --format codeframe --ext .js,.vue .
	pug-lint server/views && jest

docker-dev-up: ## Run dockerized dev environment
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . up -d
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . exec wiki yarn dev

docker-dev-down: ## Shutdown dockerized dev environment
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . down

docker-dev-rebuild: ## Rebuild dockerized dev image
	rm -rf ./node_modules
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . build --no-cache --force-rm

docker-dev-clean: ## Clean DB, redis and data folders
	rm -rf ./data
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . exec db psql --dbname=wiki --username=wikijs --command='DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public'
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . exec redis redis-cli flushall

docker-dev-bash: ## Rebuild dockerized dev image
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . exec wiki bash

docker-build: ## Run assets generation build in docker
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . run wiki yarn build
	docker-compose -f ./dev/docker/docker-compose.yml -p wiki --project-directory . down

help: ## Display help
	@echo ''
	@echo -e 'usage: \033[1mmake [command] [args...]\033[0m'
	@echo ''
	@echo -e "$$(grep -hE '^\S+:.*##' $(MAKEFILE_LIST) | sed -e 's/:.*##\s*/:/' -e 's/^\(.\+\):\(.*\)/\\x1b[36m\1\\x1b[m:\2/' | column -c2 -t -s :)"
	@echo ''

.PHONY: clean logs
.DEFAULT_GOAL := help
