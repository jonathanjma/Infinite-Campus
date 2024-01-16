document.getElementById('launch').onclick = () => {
    chrome.tabs.create({url: chrome.runtime.getURL('pages/main.html')})
}

chrome.tabs.create({url: chrome.runtime.getURL('pages/main.html')})