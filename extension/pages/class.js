/*
things to do:
test edge cases involving initially ungraded assignments
 */

let coursesBase = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/'
let regex_result = window.location.search.match('id=(.*?)&n=(.*?)$')
coursesBase += regex_result[1]
let className = regex_result[2].split('%20').join(' ')
document.getElementById('title').innerHTML = className
document.title = className
// let coursesBase = '../../test_data/calc.json'

let categoriesMap = {}
let summaryTable = document.getElementById('summary')
let id_counter = 1;

fetch(coursesBase).then(r => r.json()).then(json => {

    // get all category json objects from infinite campus json
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

    // build categories map from IC json with assignments, point totals, etc. for each category
    let progressObj = {}
    for (let _categoryObj of _categoryObjects) {
        for (let _category of _categoryObj) {

            // build assignment list for category
            let catAssignmentsData = []
            let _catAssignments = _category['assignments']
            let scorePts = 0, totalPts = 0
            for (let _assignment of _catAssignments) {
                let notGraded = _assignment['scorePoints'] == null
                let data = {
                    'ID': _assignment['objectSectionID'],
                    'Name': _assignment['assignmentName'],
                    'Due Date': _assignment['dueDate'],
                    'Score': !notGraded ? parseFloat(_assignment['scorePoints']) : 0,
                    'Total': _assignment['totalPoints'],
                    'Include': !notGraded,
                    'Comments': _assignment['comments'],
                    'Multiplier': _assignment['multiplier'],
                }
                catAssignmentsData.push(data)
                if (!notGraded) {
                    scorePts += parseFloat(_assignment['scorePoints']) * _assignment['multiplier']
                    totalPts += _assignment['totalPoints'] * _assignment['multiplier']
                }
            }

            // sort assignments by due date
            catAssignmentsData.sort(((a, b) => {
                return Date.parse(a['Due Date']) - Date.parse(b['Due Date'])
            }))

            // overall category stats, create new entry if category exists, otherwise append/add data
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

            // keep track of IC reported category totals to determine if there are unpublished assignments
            progressObj[catName] = [_category['progress']['progressPointsEarned'], _category['progress']['progressTotalPoints']]
        }
    }
    console.log(categoriesMap)
    // console.log(progressObj)

    let pointsBased = false
    let weightTotal = 0
    let runningScore = 0, runningTotal = 0

    for (let catName in categoriesMap) {
        let category = categoriesMap[catName]

        // account for unpublished assignments
        if (category['Score'] !== progressObj[catName][0] && category['Total'] !== progressObj[catName][1]) {
            let unpubScore = progressObj[catName][0] - category['Score']
            let unpubTotal = progressObj[catName][1] - category['Total']
            let data = {
                'ID': id_counter,
                'Name': 'Unpublished Assignments',
                'Due Date': Date.now(),
                'Score': unpubScore,
                'Total': unpubTotal,
                'Include': true,
                'Comments': null,
                'Multiplier': 1,
            }
            category['Assignments'].push(data)
            category['Score'] += unpubScore
            category['Total'] += unpubTotal
            id_counter++
        }

        // create category specific html elements: heading, assignment table, add + delete assignment button
        let catHeading = document.createElement('h2')
        catHeading.innerHTML = catName
        document.body.append(catHeading)

        let catTable = document.createElement('table')
        catTable.id = catName + '_T' // category name_T = if of category table
        for (let assignment of category['Assignments']) {
            let assignmentRow = catTable.insertRow(-1)
            assignmentRow.id = assignment['ID'] // assignment id = id of assignment row
            assignmentRow.insertCell(-1).innerHTML = assignment['Name']
            assignmentRow.appendChild(createAssignInput(assignment['ID'], catName, 'Score', assignment['Score']))
            assignmentRow.appendChild(createAssignInput(assignment['ID'], catName, 'Total', assignment['Total']))
            assignmentRow.insertCell(-1).innerHTML = (assignment['Include'] ?
                ((assignment['Score'] / assignment['Total']) * 100).toFixed(2) : '-')
                + '%' // only calculate grade if assignment graded
            let deleteButton = document.createElement('button')
            deleteButton.innerHTML = 'Delete'
            deleteButton.onclick = () => {
                deleteAssignment(assignment['ID'], catName)
            }
            assignmentRow.appendChild(deleteButton)
        }
        document.body.append(catTable)

        let addButton = document.createElement('button')
        addButton.innerHTML = '+ Add'
        addButton.onclick = () => {
            addAssignment(catName)
        }
        document.body.append(document.createElement('br'))
        document.body.append(addButton)
        /////

        // overall category stats at top of page
        let catSumRow = summaryTable.insertRow(-1)
        catSumRow.id = catName // category name = id of overall stat row
        catSumRow.insertCell(0).innerHTML = catName
        catSumRow.insertCell(1).innerHTML = category['Score'].toFixed(2)
        catSumRow.insertCell(2).innerHTML = category['Total'].toFixed(2)
        catSumRow.insertCell(3).innerHTML =
            ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'

        // Build final grade using category point totals
        weightTotal += category['Weight']
        pointsBased = category['Weight'] === 0
        if (!pointsBased) { // regular grade with weighed categories
            runningTotal += (category['Score'] / category['Total']) * category['Weight']
        } else { // grade with no weighted categories
            runningScore += category['Score']
            runningTotal += category['Total']
        }
        category['Points_Based'] = pointsBased
    }

    // output final grade
    let gradeSumRow = summaryTable.insertRow(-1)
    gradeSumRow.id = 'current_grade'
    gradeSumRow.insertCell(0).innerHTML = 'Current Grade'
    gradeSumRow.insertCell(1).innerHTML = ''
    gradeSumRow.insertCell(2).innerHTML = ''
    gradeSumRow.insertCell(3).innerHTML = ((!pointsBased ?
            (runningTotal / weightTotal) : (runningScore / runningTotal))
        * 100).toFixed(2) + '%'

}).catch(error => {
    // show error message if user is not logged in to IC
    console.log(error);
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank');
    }
})

function refreshCategory(categoryName) {
    // recalculate category grade
    let category = categoriesMap[categoryName]
    console.log(categoriesMap)
    let catRow = document.getElementById(categoryName)
    catRow.children.item(1).innerHTML = category['Score'].toFixed(2)
    catRow.children.item(2).innerHTML = category['Total'].toFixed(2)
    catRow.children.item(3).innerHTML =
        ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'

    // recalculate current grade
    let runningScore = 0, runningTotal = 0
    let weightTotal = 0
    for (let catName in categoriesMap) {
        category = categoriesMap[catName]
        if (!category['Points_Based']) {
            if (category['Score'] !== 0 && category['Total'] !== 0) {
                runningTotal += (category['Score'] / category['Total']) * category['Weight']
                weightTotal += category['Weight']
            }
        } else {
            runningScore += category['Score']
            runningTotal += category['Total']
        }
    }
    let gradeSumRow = document.getElementById('current_grade')
    gradeSumRow.children.item(3).innerHTML = ((!category['Points_Based'] ?
            (runningTotal / weightTotal) : (runningScore / runningTotal))
        * 100).toFixed(2) + '%'
}

// create assignment grade inputs
function createAssignInput(id, catTitle, fieldName, initValue) {
    let input = document.createElement('input')
    input.value = initValue
    input.type = 'number'
    input.style.width = '50px'
    input.oninput = () => {
        // make sure input is not negative, default to 0 if input field is empty
        if (input.value >= 0) {
            updateAssignment(id, catTitle, fieldName, input.value.length > 0 ? parseFloat(input.value) : 0)
        }
    }
    return input
}

// update assignment grade
function updateAssignment(id, catTitle, fieldName, newVal) {
    let assignRow = document.getElementById(id)
    for (let assign of categoriesMap[catTitle]['Assignments']) {
        if (assign['ID'] === id) {
            // if assignment was ungraded before we need to update both the category's score and total points
            if (!assign['Include']) {
                categoriesMap[catTitle][fieldName] += newVal
                let field2 = fieldName === 'Score' ? 'Total' : 'Score'
                categoriesMap[catTitle][field2] += assign[field2] * assign['Multiplier']
                assign['Include'] = true
            } else { // otherwise only the delta of the changed score/total is needed
                categoriesMap[catTitle][fieldName] += (newVal - assign[fieldName]) * assign['Multiplier']
            }
            assign[fieldName] = newVal
            // update row with new grade
            assignRow.children.item(fieldName === 'Score' ? 1 : 2).value = newVal
            assignRow.children.item(3).innerHTML =
                ((assign['Score'] / assign['Total']) * 100).toFixed(2) + '%'
        }
    }
    refreshCategory(catTitle)
}

// add assignment
function addAssignment(catTitle) {
    // add map entry
    let data = {
        'ID': id_counter,
        'Name': 'New Assignment',
        'Due Date': Date.now(),
        'Score': 0,
        'Total': 0,
        'Include': true,
        'Comments': null,
        'Multiplier': 1,
    }
    id_counter++
    categoriesMap[catTitle]['Assignments'].push(data)
    categoriesMap[catTitle]['Score'] += data['Score']
    categoriesMap[catTitle]['Total'] += data['Total']

    // create new assignment row
    let catTable = document.getElementById(catTitle + '_T')
    let assignmentRow = catTable.insertRow(-1)
    assignmentRow.id = data['ID']
    assignmentRow.insertCell(-1).innerHTML = data['Name']
    assignmentRow.appendChild(createAssignInput(data['ID'], catTitle, 'Score', data['Score']))
    assignmentRow.appendChild(createAssignInput(data['ID'], catTitle, 'Total', data['Total']))
    assignmentRow.insertCell(-1).innerHTML =
        ((data['Score'] / data['Total']) * 100).toFixed(2) + '%'
    let deleteButton = document.createElement('button')
    deleteButton.innerHTML = 'Delete'
    deleteButton.onclick = () => {
        deleteAssignment(data['ID'], catTitle)
    }
    assignmentRow.appendChild(deleteButton)
    refreshCategory(catTitle)
}

// delete assignment
function deleteAssignment(id, catTitle) {
    // delete map entry
    let i = 0;
    for (let assign of categoriesMap[catTitle]['Assignments']) {
        if (assign['ID'] === id) {
            if (assign['Include']) {
                categoriesMap[catTitle]['Score'] -= assign['Score'] * assign['Multiplier']
                categoriesMap[catTitle]['Total'] -= assign['Total'] * assign['Multiplier']
            }
            categoriesMap[catTitle]['Assignments'].remove(i)
        }
        i++
    }
    document.getElementById(id).remove() // delete row
    refreshCategory(catTitle)
}

// remove element from array
Array.prototype.remove = function(from, to) {
    let rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};
