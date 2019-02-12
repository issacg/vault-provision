"use strict"

const config = require('rc')('vault-provision', {
    priorities: [
        "/sys",
        "/"
    ],
    vaultRoot: process.env.VAULT_ADDR || "https://127.0.0.1:8200",
    vaultToken: process.env.VAULT_TOKEN || "",
    dataPath: "./data",
    template: {}
});

module.exports = config;