# Deployment

To deploy on [DigitalOcean](https://www.digitalocean.com/), follow below steps.

### Resources

Before creating resources on [DigitalOcean](https://www.digitalocean.com/) using [Terraform](https://www.terraform.io/),
you may want to create a file named `terraform.tfvars` inside `terraform` folder with below contents
and update credentials.

```terraform
do_token = "<digitalocean_access_token>"
```

To deploy the stack, you can now run below commands:

```shell
# Download required providers etc.
$ terraform -chdir=terraform init

# Deploy the stack on DigitalOcean
$ terraform -chdir=terraform apply --auto-approve
```

### Project

Once infra is set up, you can now set up server software and deploy your project.
Create a file named `variables.yml` with below contents and update values as needed.

```yaml
admin: name@example.com
app:
  port: "3000"
branch: main
env: production
domain: example.com
node:
  version: "20"
repository: git@github.com:vaibhavpandeyvpz/wapper.git
user: wapper
```

Finally, you can now deploy your project using below commands:

```shell
# Setup server software
$ ansible-playbook -i inventory.ini -u root ansible/setup.yml --extra-vars "@variables.yml"

# Setup project on server
$ ansible-playbook -i inventory.ini -u root ansible/deploy.yml --extra-vars "@variables.yml"
```

In the future, if you ever wish to update your project on server e.g., with latest code,
you can run below command to automatically pull latest changes from your Git repository:

```shell
$ ansible-playbook -i inventory.ini -u root ansible/redeploy.yml --extra-vars "@variables.yml"
```
