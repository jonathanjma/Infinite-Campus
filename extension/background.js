// background page: performs web requests from extension pages

// make IC web requests when requested by extension pages (this approach avoids CORS problems)
chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        console.log('message: ' + JSON.stringify(request))
        console.log('from: ' + sender['url'])

        if (request.message === 'home_data') {
            // nocache is dummy parameter to make sure requests are not served from cache
            let main = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades?nocache=' + Date.now()
            fetch(main).then(r => r.json()).then(json => {
                sendResponse(json)
                console.log(json)
            }).catch(error => sendResponse(error))

        } else if (request.message === 'class_data') {
            let coursesBase = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/'
                + request.id + '?nocache=' + Date.now()
            fetch(coursesBase).then(r => r.json()).then(json => {
                sendResponse(json)
                console.log(json)
            }).catch(error => sendResponse(error))
        }
        return true // required since sendResponse is called ansyc
    })