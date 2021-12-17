
let main = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades';
// let main = '../../test_data/main.json'

fetch(main).then(r => r.json()).then(json => {
    let quarter = json[0]['terms'][1] // temp get Q2
    let courses = quarter['courses']

    let table = document.getElementById('courses')

    for (let course of courses) {
        let courseId = course['sectionID']
        let courseName = course['courseName']

        let row = table.insertRow(-1)
        row.insertCell(0).innerHTML = courseName
        row.insertCell(1).innerHTML = course['teacherDisplay']
        row.insertCell(2).innerHTML =
            "<a href='class.html?id=" + courseId + "&n=" + courseName + "'>Open Class</a>"
    }

}).catch(error => {
    console.log(error);
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    document.getElementById('courses').remove()
    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank');
    }
})

