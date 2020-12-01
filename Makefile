run:
	@npm run start

update:
	@ncu -u

deploy:
	@ansible-playbook -i ~/ansible2/hosts ansible-deploy.yaml

tests:
	@npm run test

standard-fix:
	@./node_modules/standard/bin/cmd.js --fix
