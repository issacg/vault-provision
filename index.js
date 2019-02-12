"use strict"

const fs = require('fs').promises,
      Path = require('path'),   
      debug = require('debug')('vault-provision'),
      ndebug = require('debug')('net'),
      config = require('./config'),
      Mustache = require('mustache'),
      request = require('request-promise-native');

const fsroot = Path.join(process.cwd(), config.dataPath);
const vaultroot = config.vaultRoot;
const vaulttoken = config.vaultToken;
const priorities = config.priorities;

let done = {};

async function main() {
    for (let root of priorities) {
        await provisionDir(root);
    }
}

async function provisionDir(path) {
    let paths = [];
    if (done[Path.join(fsroot, path)]) {
        debug(`Skipping duplicate path ${Path.join(path)}`);
        return;        
    }
    done[Path.join(fsroot, path)] = 1;
    try {
        paths = await fs.readdir(Path.join(fsroot, path), {withFileTypes: true});
    } catch (e) {
        console.error(e.stack);
    }
    for (let file of paths) {
        if (file.isDirectory()) {
            await provisionDir(Path.join(path, file.name));
        } else {
            await provisionFile(Path.join(path, file.name));
        }
    }
}

async function provisionFile(path) {
    let data;
    let method = 'POST';
    if (Path.extname(path) != '.json') {
        debug(`Skipping unknown extension for ${path}`);
        return;
    }
    console.log(`Provisioning ${path}`)
    try {
        let json = await fs.readFile(Path.join(fsroot,path), 'utf8');
        data = JSON.parse(Mustache.render(json, config.template));
    } catch (e) {
        console.error(e.stack);
        return;
    }
    // Apply templating
    path = Mustache.render(path, config.template).replace(/\\/g,'/');
    // JSONify policy subsection
    if (Path.dirname(path).match(/^\/sys\/policy/) && data.hasOwnProperty('policy'))
        data.policy = JSON.stringify(data.policy);
    // Change method test
    if (data.hasOwnProperty('_method')) {
        method = data._method;
        delete data._method;
    }
    // Pre-commit test
    if (data.hasOwnProperty('_unless_get')) {
        let skip = true;
        let testpath = data._unless_get;
        delete data._unless_get;
        debug(`Assessing test ${vaultroot}${testpath}`)
        try {
            let rv = await request(`${vaultroot}${testpath}`, {headers: {'X-Vault-Token': vaulttoken}});
            ndebug(rv);
        } catch (e) {
            if (e.constructor.name === 'StatusCodeError' && e.statusCode === 404) {
                skip = false;
            } else {
                console.error(e.message);
            }
        }
        if (skip) {
            debug(`Skipping ${path}`);
            return;
        }
    }
    // Provision
    try {
        let uri = Path.join(Path.dirname(path), Path.basename(path,'.json'));
        let rv = await request(`${vaultroot}/v1${uri}`, {
            body: data,
            json: true,
            method: method,
            headers: {'X-Vault-Token': vaulttoken}
        });
        ndebug(rv);
    } catch (e) {
        console.log(e.message);
    }
}

main();