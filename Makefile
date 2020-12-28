run:
	@npm run start

update:
	@ncu -u

deploy:
	@ansible-playbook -i ~/ansible2/hosts ansible-deploy.yaml

install:
	@npm install

tests:
	@npm run test

standard-fix:
	@./node_modules/standard/bin/cmd.js --fix

versions:
	@printf 'NodeJS version '
	@node --version
	@npm list probot

.PHONY: run update deploy install tests standard-fix versions
