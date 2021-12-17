
// let main = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades';
let main = '../../test_data/main.json'

fetch(main).then(r => r.json()).then(json => {
    let quarter = json[0]['terms'][1] // temp get Q2
    let courses = quarter['courses']

    let table = document.getElementById('courses')

    for (let course of courses) {
        let courseId = course['sectionID']

        let row = table.insertRow(-1)
        row.insertCell(0).innerHTML = course['courseName']
        row.insertCell(1).innerHTML = course['teacherDisplay']
        row.insertCell(2).innerHTML = "<a href='class.html?id=" + courseId + "'>Open Class</a>"
    }

}).catch(error => {
    console.log(error);
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')
})

