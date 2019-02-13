# vault-provision

## Synopsis

vault-provision is a tool for provisioning the [Vault](https://vaultproject.io) tool by
HashiCorp.  It can probably be easily ported for other Hashicorp tools, too.  The tool
is conceptually based on [this blog post by HashiCorp](https://www.hashicorp.com/blog/codifying-vault-policies-and-configuration.html), but coded from scratch.

The tool iterates on a heirarchy of JSON files and sends the contents to a remote
server.  This can be used to allow runtime configuration to be serialized to
some version control system like Git.

The tool also allows for several extended methods to enhance or transform the data.

## Configuration

### Methods

vault-provision makes use of the excellent [rc](https://github.com/dominictarr/rc) module,
so variables can be passed as command line parameters, environment variables or
provided via a configuration file named .vault-provisionrc

For more detailed information about how to set parameters, see the [rc](https://github.com/dominictarr/rc#standards) page.

### Options

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `vaultRoot` | `http://127.0.0.1:8200` | The protocol, hostname and port of the Vault server. |
| `vaultToken` | None | The token used to authenticate to the Vault server. |
| `dataPath` | `./data` | The path to the local root of the JSON files. |
| `priorities` | `['/sys','/']` | An ordered list of prioritized paths used to control the order of REST calls made. |
| `template` | None | Template data to be used to transform paths and/or data |

### Vault environment variables

vault-provision will utilize the [standard Vault environment variables](https://vaultproject.io/docs/commands/environment.html) if they are defined.
Options passed directly to vault-provision (including by environment variables) will take precedence over these environment variables, but these environment
variables will take precedence over the defaults spefified in the Options section above.

For example if the environment variable `VAULT_TOKEN` is set to `foo`, and no
value for `vaultToken` is specified, vault-provision will use `foo` as the
Vault token.  However, if the environment variable `VAULT_TOKEN` is set to
`foo`, and the environment variable `vault-provision_vaultToken` is set to
`bar`, vault-provision will use `bar` as the Vault token.

## Templating

vault-provision supports simple templating via [MustacheJS](https://mustache.github.io/).  Templates use `{{` and `}}` as the delimiters.  Both paths and JSON content support templating.

## Special JSON fields
Beyond simple templating, it's possible to do advanced scripting via special key-value pairs as part of the JSON payloads.  When a special key-value pair is part of the JSON, it will be processed *locally* and, unless otherwise stated, be removed from the JSON payload before being sent to the server.

### HTTP Method

Although the default HTTP method normally used is `POST`, it's understandable that for some scenarios it may be desirable to support other verbs.  For example, if a policy is no longer desirable for use on the server, it may make sense to replace the JSON body of the policy with an empty body and call `DELETE` on the server.

Changing the method is supported by the special `"_method"` JSON key.  The value of the key is the HTTP method to be used for the API call. For example, the following snippet will delete the vault policy named 'foo'.

`/sys/policy/foo.json`
```json
{
    "_method": "DELETE"
}
```
Resulting HTTP call
```http
DELETE https://vault.server.com:8200/v1/sys/policy/foo HTTP/1.0
X-Vault-Token: xxxx
```

### Conditionals

Sometimes it may be desirable to conditionally provision a resource based on the detection of another resource.  For example, previous versions of Vault would overwrite the root certificate of the PKI backend on every call to `/pki/root/generate` which was undesirable.

It's possible to create a conditional call by using the special `"_unless_get"` JSON key.  The value of the key is the path relative to `vaultRoot` to request.  The HTTP method be `GET` and the conditional will be considered as failing if the response status code is `404`

For example, the following snippet will generate a PKI root only if no certificate already exists

`/pki/root/generate/internal.json`
```json
{
    "common_name": "My CA",
    "ttl": "87600h",
    ...
    "_unless_get": "/pki/ca/pem" 
}
```

### Policies

Vault policies need to be supplied as embedded JSON in the provisioning request.  To make this easier to maintain, the special `"policy"` (_NOT_ `"_policy"`) JSON key can be used.  The value of this key will be formatted to JSON.  Unlike other special keys, this one will transform the content, but still send it to the server.  This special key will only activate on JSON files under `/sys/policy`, which is the desired behavior for vault.

For example, the following snippet will embed JSON inside JSON to set the policy named `/foo` to read `/kv/bar`

`/sys/policy/foo.json`
```json
{
    "policy": {
        "path": {
            "/kv/bar/": {
                "capabilities": ["read"]
            }
        }
    }
}
```

This will generate the following HTTP request:
```http
POST https://vault.server.com:8200 HTTP/1.0
X-Vault-Token: xxx
Content-Type: application/json

{"policy":"{\"path\":{\"/kv/bar/\":{\"capabilities\":[\"read\"]}}}"}
```

## License

Copyright 2019 Issac Goldstand <margol@beamartyr.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

