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

smoke-test:
	@http --form POST localhost:3000/static-comments/new \
		comment[body]="static-comments is awesome" \
		comment[name]="Alex" \
		comment[email#md5]="<my@real.email>" \
		config[path]="data/somefolder" \
		config[repo]="shaftoe/testing-pr" \
		config[redirect]="https://a.l3x.in/"

.PHONY: run update deploy install tests standard-fix versions
