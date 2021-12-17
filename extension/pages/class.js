/*
https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/71480
https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/<section_id>
 */

// let coursesBase = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/'
// let courseID = window.location.search.match('id=(.*?)$')[1]
// coursesBase += courseID
let coursesBase = '../../test_data/mband.json'

let categoriesMap = {}
let summaryTable = document.getElementById('summary')
let id_counter = 1;

fetch(coursesBase).then(r => r.json()).then(json => {

    // get all category objects from infinite campus json
    let _classData = json['details']
    let _gradeObjects = []
    let _categoryObjects = []

    for (let _dataEntry of _classData) {
        if (_dataEntry['task']['taskName'] === 'Semester Final') {
            _gradeObjects.push(_dataEntry['task'])
        }
        if (_dataEntry['categories'].length > 0) {
            _categoryObjects.push(_dataEntry['categories'])
        }
    }
    // console.log(_gradeObjects)
    // console.log(_categoryObjects)

    // build categories map with assignments, point totals, etc. for each category
    let progressObj = {}
    for (let _categoryObj of _categoryObjects) {
        for (let _category of _categoryObj) {

            let catAssignmentsData = []
            let _catAssignments = _category['assignments']
            let scorePts = 0, totalPts = 0
            for (let _assignment of _catAssignments) {
                let notGraded = _assignment['scorePoints'] == null
                let data = {
                    'ID': _assignment['objectSectionID'],
                    'Name': _assignment['assignmentName'],
                    'Due Date': _assignment['dueDate'],
                    'Score': !notGraded ? parseFloat(_assignment['scorePoints']) : '-',
                    'Total': _assignment['totalPoints'],
                    'Comments': _assignment['comments'],
                    'Multiplier': _assignment['multiplier'],
                }
                catAssignmentsData.push(data)
                if (!notGraded) {
                    scorePts += parseFloat(_assignment['scorePoints']) * _assignment['multiplier']
                    totalPts += _assignment['totalPoints'] * _assignment['multiplier']
                }
            }

            catAssignmentsData.sort(((a, b) => {
                return Date.parse(a['Due Date']) - Date.parse(b['Due Date'])
            }))

            let catName = _category['name']
            if (categoriesMap[catName] === undefined) {
                categoriesMap[catName] = {
                    'Score': scorePts,
                    'Total': totalPts,
                    'Weight': _category['weight'] * 0.01,
                    'Assignments': catAssignmentsData,
                }
            } else {
                categoriesMap[catName]['Assignments'] = categoriesMap[catName]['Assignments'].concat(catAssignmentsData)
                categoriesMap[catName]['Score'] += scorePts
                categoriesMap[catName]['Total'] += totalPts
            }
            progressObj[catName] = [_category['progress']['progressPointsEarned'], _category['progress']['progressTotalPoints']]
        }
    }
    console.log(categoriesMap)
    console.log(progressObj)

    let pointsBased = false
    let weightTotal = 0
    let runningScore = 0, runningTotal = 0

    for (let catName in categoriesMap) {
        let category = categoriesMap[catName]
        // unpublished assignments
        if (category['Score'] !== progressObj[catName][0] && category['Total'] !== progressObj[catName][1]) {
            let unpubScore = progressObj[catName][0] - category['Score']
            let unpubTotal = progressObj[catName][1] - category['Total']
            let data = {
                'ID': id_counter,
                'Name': 'Unpublished Assignments',
                'Due Date': Date.now(),
                'Score': unpubScore,
                'Total': unpubTotal,
                'Comments': null,
                'Multiplier': 1,
            }
            category['Assignments'].push(data)
            category['Score'] += unpubScore
            category['Total'] += unpubTotal
            id_counter++
        }

        let catHeading = document.createElement('h2')
        catHeading.innerHTML = catName
        document.body.append(catHeading)

        let catTable = document.createElement('table')
        catTable.id = catName + '_T'
        for (let assignment of category['Assignments']) {
            let assignmentRow = catTable.insertRow(-1)
            assignmentRow.id = assignment['ID']
            assignmentRow.insertCell(-1).innerHTML = assignment['Name']
            assignmentRow.appendChild(createAssignInput(assignment['ID'], catName, 'Score', assignment['Score']))
            assignmentRow.appendChild(createAssignInput(assignment['ID'], catName, 'Total', assignment['Total']))
            assignmentRow.insertCell(-1).innerHTML = (assignment['Score'] !== '-' ?
                ((assignment['Score'] / assignment['Total']) * 100).toFixed(2) : '-')
                + '%'
        }
        document.body.append(catTable)

        let catSumRow = summaryTable.insertRow(-1)
        catSumRow.id = catName
        catSumRow.insertCell(0).innerHTML = catName
        catSumRow.insertCell(1).innerHTML = category['Score']
        catSumRow.insertCell(2).innerHTML = category['Total']
        catSumRow.insertCell(3).innerHTML =
            ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'

        weightTotal += category['Weight']
        pointsBased = category['Weight'] === 0
        if (!pointsBased) {
            runningTotal += (category['Score'] / category['Total']) * category['Weight']
        } else {
            runningScore += category['Score']
            runningTotal += category['Total']
        }
        category['Total_Weight'] = weightTotal
        category['Points_Based'] = pointsBased
    }

    let gradeSumRow = summaryTable.insertRow(-1)
    gradeSumRow.id = 'current_grade'
    gradeSumRow.insertCell(0).innerHTML = 'Current Grade'
    gradeSumRow.insertCell(1).innerHTML = ''
    gradeSumRow.insertCell(2).innerHTML = ''
    gradeSumRow.insertCell(3).innerHTML = ((!pointsBased ?
            (runningTotal / weightTotal) : (runningScore / runningTotal))
        * 100).toFixed(2) + '%'

}).catch(error => {
    console.log(error);
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')
})

function refreshCategory(categoryName) {
    // update category grade
    let category = categoriesMap[categoryName]
    let catRow = document.getElementById(categoryName)
    catRow.children.item(1).innerHTML = category['Score']
    catRow.children.item(2).innerHTML = category['Total']
    catRow.children.item(3).innerHTML =
        ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'

    // update current/composite grade
    let runningScore = 0, runningTotal = 0
    for (let catName in categoriesMap) {
        category = categoriesMap[catName]
        if (!category['Points_Based']) {
            runningTotal += (category['Score'] / category['Total']) * category['Weight']
        } else {
            runningScore += category['Score']
            runningTotal += category['Total']
        }
    }
    let gradeSumRow = document.getElementById('current_grade')
    gradeSumRow.children.item(3).innerHTML = ((!category['Points_Based'] ?
            (runningTotal / category['Total_Weight']) : (runningScore / runningTotal))
        * 100).toFixed(2) + '%'

}

function createAssignInput(id, catTitle, fieldName, initValue) {
    let input = document.createElement('input')
    input.value = initValue
    input.type = 'number'
    input.style.width = '50px'
    input.oninput = () => {
        // make sure input is not negative, default to 0 if no input value
        if (input.value >= 0) {
            updateAssignment(id, catTitle, fieldName, input.value.length > 0 ? parseFloat(input.value) : 0)
        }
    }
    return input
}

function updateAssignment(id, catTitle, fieldName, newVal) {
    let assignRow = document.getElementById(id)
    for (let assign of categoriesMap[catTitle]['Assignments']) {
        if (assign['ID'] === id) {
            categoriesMap[catTitle][fieldName] += newVal - assign[fieldName]
            assign[fieldName] = newVal
            assignRow.children.item(fieldName === 'Score' ? 1 : 2).value = newVal
            assignRow.children.item(3).innerHTML =
                ((assign['Score'] / assign['Total']) * 100).toFixed(2) + '%'
        }
    }
    refreshCategory(catTitle)
}
