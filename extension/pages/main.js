
let main = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades'
// let main = '../../test_data/main.json'

let gradingPeriods = 2 // # semesters
let gpSelected = 1 // default semester

// update course table when semester changed
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

let gradingPeriodJson
fetch(main).then(r => r.json()).then(json => {
    // mark semester input depending on default value
    document.getElementById('sem1').checked = gpSelected === 1
    document.getElementById('sem2').checked = gpSelected !== 1

    gradingPeriodJson = json[0]['terms']
    createHomeTable()

}).catch(error => {
    console.log(error);
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    document.getElementById('semChoose').remove()
    document.getElementById('courses_T').remove()
    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank')
    }
})

// populate course table based on semester
function createHomeTable() {
    let gradingPeriod = gradingPeriodJson[gradingPeriods * gpSelected - 1]
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

        // link to open class-specific page
        let classLink = document.createElement('a')
        classLink.innerHTML = 'Open Class'
        classLink.href = 'class.html?id=' + courseId + '&n=' + courseName + '&gp=' + gpSelected
        courseRow.appendChild(classLink)
    }
}
