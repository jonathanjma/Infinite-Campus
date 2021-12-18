// CORS Header bypass code courtesy of:
// https://github.com/balvin-perrie/Access-Control-Allow-Origin---Unblock

const DEFAULT_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
const prefs = {
    'overwrite-origin': true,
    'methods': DEFAULT_METHODS,
    'allow-origin-value': '*',
};
const active_urls = [chrome.extension.getURL('')+'*'] // only block cors headers on extension pages

const redirects = {};
chrome.tabs.onRemoved.addListener(tabId => delete redirects[tabId]);
const cors = {};

cors.onBeforeRedirect = d => {
    if (d.type === 'main_frame') {
        return;
    }
    redirects[d.tabId] = redirects[d.tabId] || {};
    redirects[d.tabId][d.requestId] = true;
};

cors.onHeadersReceived = d => {
    if (d.type === 'main_frame') {
        return;
    }
    const {initiator, originUrl, responseHeaders, requestId, tabId} = d;
    if (redirects[tabId]) {
        delete redirects[tabId][requestId];
    }

    if (prefs['overwrite-origin'] === true) {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-origin');

        if (o) {
            if (o.value !== '*') {
                o.value = prefs['allow-origin-value'];
            }
        }
        else {
            responseHeaders.push({
                'name': 'Access-Control-Allow-Origin',
                'value': prefs['allow-origin-value']
            });
        }
    }
    if (prefs.methods.length > 3) { // GET, POST, HEAD are mandatory
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-methods');
        if (o) {
            // only append methods that are not in the supported list
            o.value = [...new Set([...prefs.methods, ...o.value.split(/\s*,\s*/).filter(a => {
                return DEFAULT_METHODS.indexOf(a) === -1;
            })])].join(', ');
        }
        else {
            responseHeaders.push({
                'name': 'Access-Control-Allow-Methods',
                'value': prefs.methods.join(', ')
            });
        }
    }
    return {responseHeaders};
};
cors.install = () => {
    cors.remove();
    const extra = ['blocking', 'responseHeaders', 'extraHeaders'];
    chrome.webRequest.onHeadersReceived.addListener(cors.onHeadersReceived, {
        urls: active_urls
    }, extra);
    chrome.webRequest.onBeforeRedirect.addListener(cors.onBeforeRedirect, {
        urls: active_urls
    });
};
cors.remove = () => {
    chrome.webRequest.onHeadersReceived.removeListener(cors.onHeadersReceived);
    chrome.webRequest.onBeforeRedirect.removeListener(cors.onBeforeRedirect);
};