// CORS Header bypass code from
// https://github.com/balvin-perrie/Access-Control-Allow-Origin---Unblock

const DEFAULT_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
const prefs = {
    'enabled': false,
    'overwrite-origin': true,
    'methods': DEFAULT_METHODS,
    'remove-x-frame': true,
    'allow-credentials': true,
    'allow-headers-value': '*',
    'allow-origin-value': '*',
    'expose-headers-value': '*',
    'allow-headers': false,
    'unblock-initiator': true
};
const active_urls = [chrome.extension.getURL('')+'*']

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
    let origin = '';

    const redirect = redirects[tabId] ? redirects[tabId][requestId] : false;
    if (prefs['unblock-initiator'] && redirect !== true) {
        try {
            const o = new URL(initiator || originUrl);
            origin = o.origin;
        }
        catch (e) {
            console.warn('cannot extract origin for initiator', initiator);
        }
    }
    else {
        origin = '*';
    }
    if (redirects[tabId]) {
        delete redirects[tabId][requestId];
    }

    if (prefs['overwrite-origin'] === true) {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-origin');

        if (o) {
            if (o.value !== '*') {
                o.value = origin || prefs['allow-origin-value'];
            }
        }
        else {
            responseHeaders.push({
                'name': 'Access-Control-Allow-Origin',
                'value': origin || prefs['allow-origin-value']
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
    // The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*'
    // when the request's credentials mode is 'include'.
    if (prefs['allow-credentials'] === true) {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-origin');
        if (!o || o.value !== '*') {
            const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-credentials');
            if (o) {
                o.value = 'true';
            }
            else {
                responseHeaders.push({
                    'name': 'Access-Control-Allow-Credentials',
                    'value': 'true'
                });
            }
        }
    }
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
    if (prefs['allow-headers'] === true) {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-headers');
        if (o) {
            o.value = prefs['allow-headers-value'];
        }
        else {
            responseHeaders.push({
                'name': 'Access-Control-Allow-Headers',
                'value': prefs['allow-headers-value']
            });
        }
    }
    if (prefs['allow-headers'] === true) {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-expose-headers');
        if (o) {
            o.value = prefs['expose-headers-value'];
        }
        else {
            responseHeaders.push({
                'name': 'Access-Control-Expose-Headers',
                'value': prefs['expose-headers-value']
            });
        }
    }
    if (prefs['remove-x-frame'] === true) {
        const i = responseHeaders.findIndex(({name}) => name.toLowerCase() === 'x-frame-options');
        if (i !== -1) {
            responseHeaders.splice(i, 1);
        }
    }
    return {responseHeaders};
};
cors.install = () => {
    cors.remove();
    const extra = ['blocking', 'responseHeaders'];
    if (/Firefox/.test(navigator.userAgent) === false) {
        extra.push('extraHeaders');
    }
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