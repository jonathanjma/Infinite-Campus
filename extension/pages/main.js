/*
things to do:
move trend graph to home or class page (also make it collapsible)

show unread IC notifications for grade updates on home page
    (https://github.com/codingmarket07/Notification-Dropdown-Nov19)
    could also implement browser notifications by fetching every 5 min

about page
'settings' page for non-fusd?

note: 1216 x 760 for web store screenshots
 */

// home page: shows course table with links to course pages

let gradingPeriods = 2 // # semesters
let gpSelected = 1 // default semester

// when radio buttons clicked, update course table when semester changed
document.getElementById('sem1').onclick = () => {
    if (gpSelected !== 1) {
        gpSelected = 1
        createHomeTable()
    }
}
document.getElementById('sem2').onclick = () => {
    if (gpSelected !== 2) {
        gpSelected = 2
        createHomeTable()
    }
}

let gradingPeriodsJson // json with all semesters
// get home page json data from background.js
chrome.runtime.sendMessage({message: 'home_data'}, (json) => {
    try {
        pageAction(json)
    } catch (error) {
        console.log(error);
        console.log('json response:')
        console.log(json)
        pageError()
    }
})

// set up courses table
function pageAction(json) {
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
