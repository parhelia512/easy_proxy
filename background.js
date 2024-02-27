var easyDefault = {
    proxies: [],
    fallback: null
};
var easyStorage = {};
var easyPAC = '';
var neoPAC = '';
var easyProxy;
var easyFallback = [];
var easyFallbackLogs = {};
var easyTempo = {};
var easyTempoLogs = {};

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_plugins':
            response({storage: {...easyDefault, ...easyStorage}, pac_script: easyPAC});
            break;
        case 'options_onchange':
            easyOptionsChanges(params, response);
            break;
        case 'easyproxy_newtempo':
            easyTempoProxy(params);
            break;
        case 'easyproxy_purgetempo':
            easyTempoPurge();
    }
});

function easyOptionsChanges({storage, removed}, response) {
    easyStorage = storage;
    easyProxy = storage.fallback;
    pacScriptConverter();
    response({pac_script: easyPAC});
    setEasyProxy(neoPAC);
    chrome.storage.local.set(storage);
    if (removed?.length > 0) {
        chrome.storage.local.remove(removed);
    }
}

function easyTempoProxy({proxy, matches}) {
    if (easyTempo[proxy] === undefined) {
        easyTempo[proxy] = [];
        easyTempoLogs[proxy] = {};
    }
    var tempo = easyTempo[proxy];
    var logs = easyTempoLogs[proxy];
    var result = [];
    matches.forEach((rule) => {
        if (logs[rule] === undefined) {
            logs[rule] = true;
            result.push(rule);
        }
    });
    console.log('Proxy server: ' + proxy + '\nTempo: ' + result.join(' '));
    tempo.push(...result);
    pacScriptConverter();
    setEasyProxy(neoPAC);
}

function easyTempoPurge() {
    easyTempo = {};
    easyTempoLogs = {};
}

chrome.webRequest.onErrorOccurred.addListener(({url, tabId, error}) => {
    if (error === 'net::ERR_BLOCKED_BY_CLIENT') {
        return;
    }
    var {host} = new URL(url);
    if (!easyProxy) {
        return console.log('Error occurred: ' + host + '\n' + error);
    }
    if (error === 'net::ERR_FAILED' || easyFallbackLogs[host]) {
        return;
    }
    easyFallbackLogs[host] = true;
    easyFallback.push(host);
    pacScriptConverter();
    setEasyProxy(neoPAC);
    console.log('Proxy fallback: ' + host);
}, {urls: ["<all_urls>"]});

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    easyProxy = easyStorage.fallback;
    pacScriptConverter();
    setEasyProxy(easyPAC);
});

function pacScriptConverter(pac_script = '', tempo = '') {
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage[proxy].length > 0) {
            pac_script += convertRegexp(proxy, easyStorage[proxy]);
        }
        if (easyTempo[proxy]?.length > 0) {
            tempo += convertRegexp(proxy, easyTempo[proxy]);
        }
    });
    easyPAC = convertPacScript(pac_script);
    if (easyProxy && easyFallback.length > 0) {
        tempo += convertRegexp(easyProxy, easyFallback);
    }
    neoPAC = convertPacScript(pac_script + tempo);
}

function convertRegexp(proxy, matches) {
    return '\n    if (/^(' + matches.join('|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}

chrome.runtime.onInstalled.addListener(async ({previousVersion}) => {
    if (previousVersion <= '0.2.0') {
        var json = await chrome.storage.sync.get(null);
        json.proxies.forEach((proxy) => json[proxy] = json[proxy].split(' '));
        easyStorage = json;
        pacScriptConverter();
        setEasyProxy(neoPAC);
        chrome.storage.local.set(easyStorage);
        chrome.storage.sync.clear();
    }
});
