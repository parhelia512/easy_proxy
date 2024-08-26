var easyProfile = {};
var easyProxy = {};
var removed = [];
var options = document.body.classList;
var [newBtn, saveBtn, profile, exporter, manager] = document.querySelectorAll('[data-bid="new_btn"], [data-bid="save_btn"], a, #profile, #manager');
var [profileLET, pacLET, matchLET] = document.querySelectorAll('.template > *');
document.querySelectorAll('#profile > [name]').forEach((item) => easyProxy[item.name] = item);

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveBtn.click();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'new_btn':
            options.toggle('new_profile');
            break;
        case 'save_btn':
            optionsSaved();
            break;
        case 'export_btn':
            optionsExport(event.ctrlKey && event.altKey);
            break;
        case 'submit_btn':
            profileSubmit();
            break;
        case 'detail_btn':
            profileDetail(event.target.dataset.pid);
            break;
        case 'remove_btn':
            profileRemove(event.target.dataset.pid);
            break;
    }
});

async function optionsSaved() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage, removed}}, (params) => {
        easyPAC = params.pac_script;
        removed = [];
    });
}

function optionsExport(pacScript) {
    if (pacScript) {
        var data = easyPAC;
        var type = 'application/x-ns-proxy-autoconfig;charset=utf-8;';
        var ext = '.pac';
    }
    else {
        data = JSON.stringify(easyStorage, null, 4);
        type = 'application/json;charset=utf-8;';
        ext = '.json';
    }
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob([data], {type});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = 'easy_proxy-' + time + ext;
    exporter.click();
}

function profileSubmit() {
    var proxy = easyProxy.proxy.value;
    if (/([^\.]+\.){1,}[^:]+(:\d+)?/.test(proxy)) {
        var profile = easyProxy.scheme.value + ' ' + proxy;
        easyStorage[profile] = [];
        easyStorage.proxies.push(profile);
        createMatchPattern(profile);
        easyProxy.scheme.value = 'PROXY';
        easyProxy.proxy.value = '';
        options.remove('new_profile');
        saveBtn.disabled = false;
    }
}

function profileDetail(id) {
    easyProfile[id].classList.toggle('expand');
}

function profileRemove(id) {
    saveBtn.disabled = false;
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    delete easyStorage.pacs[id];
    if (!removed.includes(id)) {
        removed.push(id);
    }
    delete easyStorage[id];
}

document.querySelector('#manager').addEventListener('change', (event) => {
    easyStorage[event.target.dataset.pid] = event.target.value.match(/[^\s]+/g) ?? [];
    saveBtn.disabled = false;
});

document.querySelector('#files').addEventListener('change', async (event) => {
    saveBtn.disabled = true;
    await Promise.all([...event.target.files].map(importHandler));
    optionsSaved();
    options.remove('new_profile');
    event.target.value = '';
});

function importHandler(file) {
    return new Promise((resolve) => {
        var fileReader = new FileReader();
        fileReader.onload = (event) => {
            var result = event.target.result;
            if (file.name.endsWith('.json')) {
                var json = JSON.parse(result);
                removed = easyStorage.proxies.filter((proxy) => !json[proxy]);
                easyStorage = json;
                manager.innerHTML = '';
                easyOptionsSetup();
            }
            else {
                var pac = easyStorage.proxies.find((id) => easyStorage[id] === result);
                if (!pac) {
                    var pacId = 'PAC ' + Date.now().toString(16);
                    easyStorage[pacId] = result;
                    easyStorage.pacs[pacId] = true;
                    easyStorage.proxies.push(pacId);
                    createPacScript(proxy);
                }
            }
            resolve(removed);
        };
        fileReader.readAsText(file);
    });
}

chrome.runtime.sendMessage({action: 'options_initial'}, (params) => {
    easyStorage = params.storage;
    easyPAC = params.pac_script;
    easyOptionsSetup();
});

function easyOptionsSetup() {
    easyStorage.proxies.forEach((proxy) => {
        easyStorage.pacs[proxy] ? createPacScript(proxy) : createMatchPattern(proxy);
    });
}

function createMatchPattern(id) {
    var profile = profileLET.cloneNode(true);
    profile.querySelectorAll('[class]').forEach((item) => profile[item.className] = item);
    profile.proxy.textContent = profile.delete.dataset.pid = id;
    profile.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addPattern(profile.matches, id, profile.entry);
        }
    });
    profile.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'append_btn':
                addPattern(profile.matches, id, profile.entry);
                break;
            case 'resort_btn':
                resortPattern(profile.matches, id);
                break;
            case 'splice_rule':
                removePattern(id, event.target.dataset.mid);
                break;
        }
    });
    listMatchPattern(profile.matches, id, easyStorage[id]);
    easyProfile[id] = profile;
    manager.append(profile);
}

function listMatchPattern(list, id, matches) {
    matches.forEach((value) => {
        var match = matchLET.cloneNode(true);
        var [content, button] = match.querySelectorAll('*');
        match.title = content.textContent = button.dataset.value = value;
        button.dataset.pid = id;
        list.appendChild(match);
    });
}

function addPattern(list, id, entry) {
    
}

function resortPattern(list, id) {
    saveBtn.disabled = false;
    easyStorage[id] = easyStorage[id].sort();
    var resort = [...list.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...resort);
}

function removePattern(id, value) {
    
}

function createPacScript(id) {
    var profile = pacLET.cloneNode(true);
    profile.querySelectorAll('[class]').forEach((item) => profile[item.className] = item);
    profile.proxy.textContent = profile.delete.dataset.pid = id;
    profile.content.textContent = easyStorage[id];
    manager.append(profile);
    easyProfile[id] = profile;
}
