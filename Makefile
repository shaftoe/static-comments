update:
	@ncu -u

apply:
	@ansible-playbook -i ~/ansible2/hosts ansible-deploy.yaml
