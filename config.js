"use strict"

const config = require('rc')('vault-provision', {
    priorities: [
        "/sys",
        "/"
    ],
    vaultRoot: "https://127.0.0.1:8200",
    vaultToken: "",
    dataPath: "./data",
    template: {}
});

module.exports = config;