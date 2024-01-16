/*
things to do:
show unread IC notifications for grade updates on home page: https://github.com/codingmarket07/Notification-Dropdown-Nov19
    could also implement browser notifications by fetching every 5 min
about/help page

note: 1216 x 760 for web store screenshots
 */

// home page: shows course table with links to course pages

let gradingPeriods = 2 // # semesters
let gpSelected = 1 // default semester

// button to update default semester
let defaultBtn = document.getElementById('gpDefault')
defaultBtn.onclick = () => {
    // console.log(gpSelected)
    defaultGp = gpSelected
    defaultBtn.disabled = true
    chrome.storage.local.set({'gpDefault': gpSelected})
}

let gradingPeriodsJson // json with all semesters
let defaultGp // default semester for home page

// get home page json data from background.js
chrome.runtime.sendMessage({message: 'home_data'}, (json) => {

    // get default semester
    chrome.storage.local.get(['gpDefault'], (data) => {
        document.getElementById('loading').hidden = true
        try {
            defaultGp = data.gpDefault
            gpSelected = defaultGp
            console.log(defaultGp)
            pageAction(json)
        } catch (error) {
            console.log(error);
            // console.log('json response:')
            // console.log(json)
            pageError()
        }
    })
})

// set up courses table
function pageAction(json) {
    // when radio buttons clicked, update course table when semester changed
    // enable/disable default changer button depending on semester selected
    document.getElementById('sem1').onclick = () => {
        if (gpSelected !== 1) {
            gpSelected = 1
            defaultBtn.disabled = defaultGp === gpSelected
            createHomeTable()
        }
    }
    document.getElementById('sem2').onclick = () => {
        if (gpSelected !== 2) {
            gpSelected = 2
            defaultBtn.disabled = defaultGp === gpSelected
            createHomeTable()
        }
    }

    // mark semester input depending on default value
    document.getElementById('sem1').checked = gpSelected === 1
    document.getElementById('sem2').checked = gpSelected !== 1

    gradingPeriodsJson = json[0]['terms']
    createHomeTable()
}

// if error occurs during parsing/set up (most likely user not logged in)
function pageError() {
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    // auto launch popup window to log in
    let width = 650, height = 500
    let left = (screen.width - width) / 2, top = (screen.height - height) / 2
    window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp','popUpWindow',
        `width=${width},height=${height},left=${left},top=${top}`)

    document.getElementById('semChoose').remove()
    document.getElementById('courses_T').remove()
    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank')
    }
    document.getElementById('refresh').onclick = () => location.reload()
}

// populate course table based on semester
function createHomeTable() {
    let gradingPeriod = gradingPeriodsJson[gradingPeriods * gpSelected - 1]
    let courses = gradingPeriod['courses']

    let tableBody = document.getElementById('courses')
    tableBody.innerHTML = '' // clear course rows

    for (let course of courses) {
        let courseId = course['sectionID']
        let courseName = course['courseName']

        let courseRow = tableBody.insertRow(-1)
        courseRow.insertCell(0).innerHTML = courseName
        courseRow.insertCell(1).innerHTML = course['teacherDisplay']

        // show current grade
        let grades = course['gradingTasks']
        for (let grade of grades) {
            if (grade['taskName'] === 'Semester Final') {
                courseRow.insertCell(2).innerHTML =
                    (grade['progressPercent'] !== undefined ? grade['progressPercent'] : '-') + '%'
                // percent is quarter end snapshot, progressPercent is now snapshot
                courseRow.insertCell(3).innerHTML =
                    grade['progressScore'] !== undefined ? grade['progressScore'] : '-'
                break
            }
        }

        // button to open class-specific page
        let classButton = document.createElement('button')
        classButton.innerHTML = 'Open Class'
        classButton.style.padding = '5px 15px'
        classButton.onclick = () => {
            window.open(`class.html?id=${courseId}&n=${courseName}&gp=${gpSelected}`, '_self')
        }
        courseRow.insertCell(4).appendChild(classButton)
    }
}
