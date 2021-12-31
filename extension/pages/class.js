/*
things to do:
rename new assignments
reset updated assignments
back to home page button
grade over time graph (unpublished assignments might be sus: solid line pub, dotted unpub?)
improve ui (change font/colors/padding)

note: 1024 x 640 for web store screenshots
 */

let production = true
let coursesBase

let gpSelected = 1 // default semester (will be overwritten by url parameter if it exists)

if (production) {
    coursesBase = 'https://fremontunifiedca.infinitecampus.org/campus/resources/portal/grades/detail/'
    let regex_result = window.location.search.match('id=(.*?)&n=(.*?)&gp=(.*?)$') // get class id + name + semester from url
    coursesBase += regex_result[1]
    let className = regex_result[2].split('%20').join(' ')
    document.getElementById('title').innerHTML = className
    document.title = className
    gpSelected = parseInt(regex_result[3])
} else {
    coursesBase = '../../test_data/band.json'
}

let categoriesMap = {}
let summaryTable = document.getElementById('summary') // grade/category summary table
let id_counter = 1 // to ensure all assignments have unique html element ids

let gradeOriginalNumer = 0, gradeOriginalDenom = 0 // for % grade difference

fetch(coursesBase).then(r => r.json()).then(json => {

    // get all category json objects from infinite campus json
    let _classData = json['details']
    let _categoryObjects = []

    let quarterCount = 0
    for (let _dataEntry of _classData) {
        if (_dataEntry['categories'].length > 0) {
            _categoryObjects.push(_dataEntry['categories'])
        }
        // use 'quarter grade' since only quarter entries contain assignments
        if (_dataEntry['task']['taskName'] === 'Quarter Grade') {
            quarterCount++
            // exit when quarter count equals desired semester (*2 to convert to quarters)
            if (quarterCount === gpSelected*2) {
                break
            }
            // if desired semester not reached and quarter count is even:
                // reset assignments
            // if desired semester not reached and quarter count is odd:
                // don't reset since quarter is q1 or q3, and we need those assignments
            else if (quarterCount % 2 !== 1) {
                _categoryObjects = []
            }
        }
    }
    // console.log(_categoryObjects)

    // build categories map from IC json with assignments, point totals, etc. for each category
    let progressObj = {}
    for (let _categoryObj of _categoryObjects) {
        for (let _category of _categoryObj) {
            console.log(_category)

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
                    'Original Score': scorePts,
                    'Original Total': totalPts,
                    'Weight': _category['weight'] * 0.01,
                    'Assignments': catAssignmentsData,
                }
            } else {
                categoriesMap[catName]['Assignments'] = categoriesMap[catName]['Assignments'].concat(catAssignmentsData)
                categoriesMap[catName]['Score'] += scorePts
                categoriesMap[catName]['Total'] += totalPts
                categoriesMap[catName]['Original Score'] += scorePts
                categoriesMap[catName]['Original Total'] += totalPts
            }

            // keep track of IC reported category totals to determine if there are unpublished assignments
            if (_category['progress'] !== null) {
                progressObj[catName] = [_category['progress']['progressPointsEarned'], _category['progress']['progressTotalPoints']]
            } else { // if categories have assignments, but they are all ungraded
                progressObj[catName] = [categoriesMap[catName]['Score'], categoriesMap[catName]['Total']]
            }
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

        // create category specific html elements: heading, assignment rows + table, add assignment button
        let catHeading = document.createElement('h2')
        catHeading.innerHTML = catName
        document.body.append(catHeading)

        let catTable = document.createElement('table')
        catTable.id = catName + '_T' // category name_T = if of category table
        catTable.style.paddingLeft = '20px'
        for (let assignment of category['Assignments']) {
            createAssignmentRow(assignment, catTable, catName, false)
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

        // Build final grade using category point totals
        weightTotal += category['Weight'] // needed if categories have no assignments
        pointsBased = category['Weight'] === 0
        if (!pointsBased) { // regular grade with weighed categories
            runningTotal += (category['Score'] / category['Total']) * category['Weight']
        } else { // grade with no weighted categories
            runningScore += category['Score']
            runningTotal += category['Total']
        }
        category['Points Based'] = pointsBased

        // overall category stats at top of page
        let catSumRow = summaryTable.insertRow(-1)
        catSumRow.id = catName // category name = id of overall stat row
        catSumRow.insertCell(0).innerHTML = catName
        catSumRow.insertCell(1).innerHTML = (!pointsBased ? category['Weight']*100 : '-') + '%'
        catSumRow.insertCell(2).innerHTML = category['Score'].toFixed(2)
        catSumRow.insertCell(3).innerHTML = category['Total'].toFixed(2)
        catSumRow.insertCell(4).innerHTML =
            ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'
        catSumRow.insertCell(5).innerHTML = '0.00%'
    }

    // output final grade
    let gradeSumRow = summaryTable.insertRow(-1)
    gradeSumRow.id = 'current_grade'
    gradeSumRow.insertCell(0).innerHTML = 'Current Grade'
    gradeSumRow.insertCell(1).innerHTML = ''
    gradeSumRow.insertCell(2).innerHTML = ''
    gradeSumRow.insertCell(3).innerHTML = ''
    gradeOriginalNumer = !pointsBased ? runningTotal : runningScore
    gradeOriginalDenom = !pointsBased ? weightTotal : runningTotal
    gradeSumRow.insertCell(4).innerHTML =
        ((gradeOriginalNumer / gradeOriginalDenom) * 100).toFixed(2) + '%'
    gradeSumRow.insertCell(5).innerHTML = '0.00%'

}).catch(error => {
    // show error message if user is not logged in to IC
    console.log(error)
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    document.getElementById('summary').remove()
    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank')
    }
})

function refreshCategory(categoryName) {
    // recalculate category summary
    let category = categoriesMap[categoryName]
    console.log(categoriesMap)
    let catRow = document.getElementById(categoryName)
    catRow.children.item(2).innerHTML = category['Score'].toFixed(2)
    catRow.children.item(3).innerHTML = category['Total'].toFixed(2)
    catRow.children.item(4).innerHTML =
        ((category['Score'] / category['Total']) * 100).toFixed(2) + '%'
    catRow.children.item(5).innerHTML =
        ((category['Score'] / category['Total'] - category['Original Score'] / category['Original Total']) * 100)
            .toFixed(2) + '%'

    // recalculate current grade
    let runningScore = 0, runningTotal = 0
    let weightTotal = 0
    for (let catName in categoriesMap) {
        category = categoriesMap[catName]
        if (!category['Points Based']) {
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
    let gradeNumer = !category['Points Based'] ? runningTotal : runningScore
    let gradeDenom = !category['Points Based'] ? weightTotal : runningTotal
    gradeSumRow.children.item(4).innerHTML =
        ((gradeNumer / gradeDenom) * 100).toFixed(2) + '%'
    gradeSumRow.children.item(5).innerHTML =
        ((gradeNumer / gradeDenom - gradeOriginalNumer / gradeOriginalDenom) * 100)
            .toFixed(2) + '%'
}

// create assignment grade inputs
function createAssignmentInput(id, catTitle, fieldName, initValue) {
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
            // if assignment was ungraded before we need to update both the category's total score and points
            if (!assign['Include']) {
                categoriesMap[catTitle][fieldName] += newVal
                let field2 = fieldName === 'Score' ? 'Total' : 'Score'
                categoriesMap[catTitle][field2] += assign[field2] * assign['Multiplier']
                assign['Include'] = true
            } else { // otherwise, only the delta of the changed score/total is needed
                categoriesMap[catTitle][fieldName] += (newVal - assign[fieldName]) * assign['Multiplier']
            }
            assign[fieldName] = newVal // update assignment grade
            // update row with new grade
            assignRow.children.item(fieldName === 'Score' ? 2 : 3).value = newVal
            assignRow.children.item(4).innerHTML =
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
    createAssignmentRow(data, catTable, catTitle, true)
    refreshCategory(catTitle)
}

// create html row for each assignment
function createAssignmentRow(assignmentData, categoryTable, categoryName, userAdded) {
    let assignmentRow = categoryTable.insertRow(-1)
    assignmentRow.id = assignmentData['ID'] // assignment id = id of assignment row

    let deleteButton = document.createElement('button')
    deleteButton.innerHTML = 'X'
    deleteButton.onclick = () => {
        deleteAssignment(assignmentData['ID'], categoryName)
    }
    assignmentRow.appendChild(deleteButton)

    // if assignment is added by user, add input box so they can give it a name
    if (!userAdded) {
        assignmentRow.insertCell(-1).innerHTML = assignmentData['Name']
    } else {
        let input = document.createElement('input')
        input.value = assignmentData['Name']
        input.type = 'text'
        input.style.width = '120px'
        input.addEventListener('keyup', ({key}) => {
            if (key === 'Enter') {
                assignmentRow.children.item(1).innerHTML = input.value // remove input box
                // update assignment name
                for (let assign of categoriesMap[categoryName]['Assignments']) {
                    if (assign['ID'] === assignmentData['ID']) {
                        assign['Name'] = input.value
                    }
                }
            }
        })
        assignmentRow.insertCell(-1).appendChild(input)
    }
    assignmentRow.appendChild(createAssignmentInput(assignmentData['ID'], categoryName, 'Score', assignmentData['Score']))
    assignmentRow.appendChild(createAssignmentInput(assignmentData['ID'], categoryName, 'Total', assignmentData['Total']))
    assignmentRow.insertCell(-1).innerHTML = (assignmentData['Include'] ?
            ((assignmentData['Score'] / assignmentData['Total']) * 100).toFixed(2) : '-')
        + '%' // only calculate grade if assignment graded

    let moreInfo = ''
    moreInfo += assignmentData['Comments'] !== null ? (assignmentData['Comments']) : ''
    moreInfo += (assignmentData['Comments'] !== null && assignmentData['Multiplier'] !== 1) ? ', ' : ''
    moreInfo += assignmentData['Multiplier'] !== 1 ? ('Point Multiplier: ' + assignmentData['Multiplier']) : ''
    assignmentRow.insertCell(-1).innerHTML = moreInfo
}

// delete assignment
function deleteAssignment(id, catTitle) {
    // delete map entry
    let i = 0
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
    let rest = this.slice((to || from) + 1 || this.length)
    this.length = from < 0 ? this.length + from : from
    return this.push.apply(this, rest)
}
