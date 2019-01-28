"use strict"

const fs = require('fs').promises,
      Path = require('path'),
      debug = require('debug')('vault-provision'),
      ndebug = require('debug')('net'),
      request = require('request-promise-native');

const fsroot = Path.join(process.cwd() ,"../data");
const vaultroot = "http://localhost:8200/v1";
const vaulttoken = '1234';

let done = {};
let priorities = [
    '/sys',
    '/'
];

async function main() {
    for (let root of priorities) {
        await provisionDir(root);
    }
}

async function provisionDir(path) {
    let paths = [];
    try {
        paths = await fs.readdir(Path.join(fsroot, path), {withFileTypes: true});
    } catch (e) {
        console.error(e.stack);
    }
    for (let file of paths) {
        if (file.isDirectory()) {
            let newpath = Path.join(fsroot, path, file.name);
            if (done[newpath]) {
                debug(`Skipping duplicate path ${Path.join(path, file.name)}`);
                continue;
            }
            done[newpath] = 1;
            await provisionDir(Path.join(path, file.name));
        } else {
            await provisionFile(Path.join(path, file.name));
        }
    }
}

async function provisionFile(path) {
    let data;
    if (Path.extname(path) != '.json') {
        debug(`Skipping unknown extension for ${path}`);
        return;
    }
    console.log(`Provisioning ${path}`)
    try {
        let json = await fs.readFile(Path.join(fsroot,path));
        data = JSON.parse(json);
    } catch (e) {
        console.error(e.stack);
        return;
    }
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
    try {
        let uri = Path.posix.join(Path.dirname(path), Path.basename(path,'.json'));
        let rv = await request(`${vaultroot}${uri}`, {
            body: data,
            json: true,
            method: 'POST',
            headers: {'X-Vault-Token': vaulttoken}
        });
        ndebug(rv);
    } catch (e) {
        console.log(e.message);
    }
}



main();