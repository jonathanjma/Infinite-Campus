// class page: grade summary, assignments sorted by categories, add/update/delete/reset assignment scores

let gpSelected = 1 // default semester (will be overwritten by url parameter if it exists)
let gpConfig = [['Q1', 'Q2'], ['Q3', 'Q4']] // define semesters (group combined grading periods)

// back to home page button
document.getElementById('back').onclick = () => {
    window.open('main.html', '_self')
}

let categoriesMap = {} // all category and assignment data

let summaryTable = document.getElementById('summary_T') // grade/category summary table
let id_counter = 1 // to ensure all assignments have unique html element ids

let gradeOriginalNumer = 0, gradeOriginalDenom = 0 // for % grade difference
let deepClone // cloned categoriesMap without user-added assignments

// get class id + name and current semester from url
let regex_result = window.location.search.match('id=(.*?)&n=(.*?)&gp=(.*?)$')
let classID = regex_result[1]
let className = regex_result[2].split('%20').join(' ')
document.getElementById('title').innerHTML = className
document.title = className
gpSelected = parseInt(regex_result[3])

// select correct grading period group depending on semester
let gpIncluded = gpConfig[gpSelected - 1];
console.log('grading periods: ' + gpIncluded)

// get class page json data from background.js
chrome.runtime.sendMessage({message: 'class_data', id: classID}, (json) => {
    try {
        pageAction(json)
    } catch (error) {
        console.log(error);
        console.log('json response:')
        console.log(json)
        pageError()
    }
})

// manual test file debug (use localhost mode)
// fetch('../../test_data/band_exclude_test_cat.json').then(r => r.json()).then(json => {pageAction(json)})
// .catch(error => {console.log(error); pageError()})

// parse IC json, initial set up of html
function pageAction(json) {

    // get all category json objects from infinite campus json
    let _classData = json['details']
    let _categoryObjects = []

    for (let _dataEntry of _classData) {
        // only add non-empty category/assignment data in current semester
        if (_dataEntry['categories'].length > 0 && gpIncluded.indexOf(_dataEntry['task']['termName']) !== -1) {
            _categoryObjects.push(_dataEntry['categories'])
        }
    }
    // console.log(_categoryObjects)

    // build categories map from IC json with assignments, point totals, etc. for each category
    let progressObj = {}
    let pointsBased = false // if class is points based (no weighted categories)
    console.log('raw IC categories:')
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
                    'Points Based': !_category['isWeighted'],
                    'Excluded': _category['isExcluded'],
                    'Assignments': catAssignmentsData,
                }
                pointsBased = !_category['isWeighted']
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
    console.log('parsed IC categories:')
    console.log(categoriesMap)
    // console.log(progressObj)

    // set up html elements for each category + summary info
    for (let catName in categoriesMap) {
        let category = categoriesMap[catName]

        // account for unpublished assignments
        if (category['Score'] !== progressObj[catName][0] && category['Total'] !== progressObj[catName][1]) {
            let unpubScore = progressObj[catName][0] - category['Score']
            let unpubTotal = progressObj[catName][1] - category['Total']
            if (unpubScore > 0.01 && unpubTotal > 0.01) { // not caused by rounding error
                let data = {
                    'ID': id_counter,
                    'Name': 'Unpublished Assignments',
                    'Due Date': (new Date).toISOString(), // time right now
                    'Score': unpubScore,
                    'Total': unpubTotal,
                    'Include': true,
                    'Comments': null,
                    'Multiplier': 1,
                }
                category['Assignments'].push(data)
                // update point totals
                category['Score'] += unpubScore; category['Total'] += unpubTotal
                category['Original Score'] += unpubScore; category['Original Total'] += unpubTotal
                id_counter++
            }
        }

        // create collapsable html element for category assignment table
        let catParent = document.createElement('details')
        catParent.open = false

        // create category header
        let catHeading = document.createElement('summary')
        catHeading.innerHTML = catName
        catParent.appendChild(catHeading)

        // create assignment table
        let catTable = document.createElement('table')
        catTable.id = catName + '_T' // category name_T = id of category table
        catTable.style.paddingLeft = '20px'
        for (let assignment of category['Assignments']) {
            createAssignmentRow(assignment, catTable, catName, false)
        }
        catParent.appendChild(catTable)
        document.body.append(catParent)
        document.body.append(document.createElement('br'))

        let weightText // how the weight of each category is shown in summary table
        if (category['Excluded']) {
            weightText = 0
        } else if (!pointsBased) { // weighed categories
            weightText = category['Weight'] * 100
        } else { // no weighted categories
            weightText = '-'
        }

        // output overall category stats into summary table
        let catSumRow = summaryTable.insertRow(-1)
        catSumRow.id = catName // category name = id of overall stat row
        catSumRow.insertCell(0).innerHTML = catName
        catSumRow.insertCell(1).innerHTML = weightText + '%'
        catSumRow.insertCell(2).innerHTML = category['Score'].toFixed(2)
        catSumRow.insertCell(3).innerHTML = category['Total'].toFixed(2)
        catSumRow.insertCell(4).innerHTML =
            fixNan(category['Score'] / category['Total'] * 100, 0).toFixed(2) + '%'
        catSumRow.insertCell(5).innerHTML = '0.00%'
    }

    // output final grade into summary table
    let gradeSumRow = summaryTable.insertRow(-1)
    gradeSumRow.id = 'current_grade'
    gradeSumRow.insertCell(0).innerHTML = 'Current Grade'
    gradeSumRow.insertCell(1).innerHTML = ''
    gradeSumRow.insertCell(2).innerHTML = ''
    gradeSumRow.insertCell(3).innerHTML = ''

    let initialGradeData = calculateGrade(categoriesMap)
    gradeOriginalNumer = initialGradeData[1]
    gradeOriginalDenom = initialGradeData[2]
    gradeSumRow.insertCell(4).innerHTML = (initialGradeData[0] * 100).toFixed(2) + '%'
    gradeSumRow.insertCell(5).innerHTML = '0.00%'

    // (end of initial grade setup) //////////////////////////////////////////////////////////////////////////////////

    // create deep clone of initial category data so that user added assignments not included
    deepClone = JSON.parse(JSON.stringify(categoriesMap))

    // populate assignment category dropdown menus
    let catDropdown = document.getElementById('catDropdown')
    let catDropdownL = document.getElementById('catDropdown2')
    Object.keys(categoriesMap).forEach((key) => {
        let option = document.createElement("option"); option.text = key
        let option2 = document.createElement("option"); option2.text = key
        catDropdown.add(option)
        catDropdownL.add(option2)
    })

    // when user submits new assignment info
    document.getElementById('assignSubmit').onclick = () => {
        let name = document.getElementById('assignName')
        let score = document.getElementById('assignScore')
        let total = document.getElementById('assignTotal')
        // make sure all are fields filled out, scores not negative
        if (catDropdown.selectedIndex !== 0 && name.value.length > 0 && score.value.length > 0 && total.value.length > 0
            && score.value >= 0 && total.value >= 0) {
            addAssignment(catDropdown.value, name.value, parseFloat(score.value), parseFloat(total.value))
            catDropdown.selectedIndex = 0 // reset dropdown + input boxes
            name.value = ''
            score.value = ''
            total.value = ''
        }
    }

    // when user submits lowest grade info
        let total = document.getElementById('lowestTotal')
        let grade = document.getElementById('lowestGrade')
        let output = document.getElementById('lowestResult')
        catDropdownL.selectedIndex = 1; total.value = 50; grade.value = 90
    document.getElementById('lowestSubmit').onclick = () => {
        let lowestScore;
        let lowestGrade = parseFloat(grade.value)
        if (catDropdownL.selectedIndex !== 0 && total.value.length > 0 && grade.value.length > 0
            && total.value >= 0 && grade.value >= 0) {

            if (pointsBased) {
                // score = lowest grade * (current total + assign total) - current score total
                lowestScore =
                    (lowestGrade / 100 * (gradeOriginalDenom + parseFloat(total.value)) - gradeOriginalNumer).toFixed(2)
            } else {
                let aocrtData = JSON.parse(JSON.stringify(deepClone))
                delete aocrtData[catDropdownL.value] // delete category we are currently simulating
                let catData = JSON.parse(JSON.stringify(deepClone[catDropdownL.value]))
                let aocrtGradeData = calculateGrade(aocrtData)
                let aocrt = aocrtGradeData[0] * aocrtGradeData[2]

                // console.log([lowestGrade / 100, gradeOriginalDenom, aocrt, catData['Weight'],
                //     catData['Total'], parseFloat(total.value), catData['Score']])

                // score = ((lowest grade * weight total - all other category running total) / category weight)
                //         (category total + assign total) - category score total
                lowestScore =
                    (((lowestGrade / 100 * gradeOriginalDenom - aocrt) / catData['Weight'])
                        * (catData['Total'] + parseFloat(total.value)) - catData['Score']).toFixed(2)
            }
            // output lowest grade message
            let message
            if (lowestScore >= 0) {
                let lowestPercent = fixNan(lowestScore / total.value * 100, 0).toFixed(2)
                message = `To maintain a <b>${lowestGrade}%</b>, you must score ≥ ${lowestScore}/${total.value} <b>(${lowestPercent}%)</b>`
            } else {
                message = `Even if you took a <b>0</b>, your grade still would be > <b>${lowestGrade}%</b>`
            }
            output.innerHTML = message
        }
    }

    // open graph button
    document.getElementById('graph').onclick = () => {
        // encode graph data in base64
        window.open(`graph.html?n=${document.title}&data=${btoa(JSON.stringify(deepClone))}`, '_self')
    }
}

// if error occurs during parsing/set up (most likely user not logged in)
function pageError() {
    console.log('sign in at https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp')

    // auto launch popup window to log in
    let width = 650, height = 500
    let left = (screen.width - width) / 2, top = (screen.height - height) / 2
    window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp','popUpWindow',
        `width=${width},height=${height},left=${left},top=${top}`)

    document.getElementById('summary_addAssign').remove()
    document.getElementById('error').hidden = false
    document.getElementById('login').onclick = () => {
        window.open('https://fremontunifiedca.infinitecampus.org/campus/portal/students/fremont.jsp', '_blank')
    }
}

// add assignment
function addAssignment(catTitle, name, scorePts, totalPts) {
    // add map entry
    let data = {
        'ID': id_counter,
        'Name': name,
        'Due Date': (new Date).toISOString(),
        'Score': scorePts,
        'Total': totalPts,
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

// update assignment grade
function updateAssignment(id, catTitle, fieldName, newVal) {
    let assign = categoriesMap[catTitle]['Assignments'].find(assignment => assignment['ID'] === id)

    // if assignment was ungraded before we need to update the category's score and total points
    if (!assign['Include']) {
        categoriesMap[catTitle][fieldName] += newVal * assign['Multiplier']
        let field2 = fieldName === 'Score' ? 'Total' : 'Score'
        categoriesMap[catTitle][field2] += assign[field2] * assign['Multiplier']
        assign['Include'] = true
    } else { // otherwise, only the delta of the changed score/total is needed
        categoriesMap[catTitle][fieldName] += (newVal - assign[fieldName]) * assign['Multiplier']
    }
    assign[fieldName] = newVal // update assignment grade
    // update row with new grade
    let assignRow = document.getElementById(id)
    assignRow.children.item(fieldName === 'Score' ? 2 : 3).value = newVal
    assignRow.children.item(4).innerHTML =
        ((assign['Score'] / assign['Total']) * 100).toFixed(2) + '%'

    refreshCategory(catTitle)
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
            break
        }
        i++
    }
    document.getElementById(id).remove() // delete row
    refreshCategory(catTitle)
}

// recalculate overall grades
function refreshCategory(categoryName) {
    // recalculate category summary
    let category = categoriesMap[categoryName]
    console.log('updated grade data:')
    console.log(categoriesMap)

    let catRow = document.getElementById(categoryName)
    catRow.children.item(2).innerHTML = category['Score'].toFixed(2)
    catRow.children.item(3).innerHTML = category['Total'].toFixed(2)
    catRow.children.item(4).innerHTML =
        fixNan(category['Score'] / category['Total'] * 100, 0).toFixed(2) + '%'
    // ^ NaN will be shown if both score and total is 0, so replace it with 0

    let catPercentDiff = (category['Score'] / category['Total'] - category['Original Score'] / category['Original Total']) * 100
    if (isNaN(catPercentDiff)) { // score and total will be 0 -> NaN if all assignments removed
        catPercentDiff = -(category['Original Score'] / category['Original Total']) * 100
    }
    catRow.children.item(5).innerHTML = catPercentDiff.toFixed(2) + '%'
    catRow.children.item(5).style.color = getDiffColor(catPercentDiff.toFixed(2)) // green if +, red -, black 0

    // recalculate current grade
    let gradeSumRow = document.getElementById('current_grade')
    let gradeData = calculateGrade(categoriesMap)
    gradeSumRow.children.item(4).innerHTML = fixNan(gradeData[0] * 100, 0).toFixed(2) + '%'

    let gradePercentDiff = (gradeData[1] / gradeData[2] - gradeOriginalNumer / gradeOriginalDenom) * 100
    if (isNaN(gradePercentDiff)) {
        gradePercentDiff = -(gradeOriginalNumer / gradeOriginalDenom) * 100
    }
    gradeSumRow.children.item(5).innerHTML = gradePercentDiff.toFixed(2) + '%'
    gradeSumRow.children.item(5).style.color = getDiffColor(gradePercentDiff.toFixed(2))
}

// calculate grade
function calculateGrade(categoriesData) {
    let runningScore = 0, runningTotal = 0
    let weightTotal = 0
    let pointsBased = false
    for (let catName in categoriesData) {
        let category = categoriesData[catName]
        if (!category['Excluded']) { // ignore excluded categories
            pointsBased = category['Points Based']
            if (!category['Points Based']) {
                // categories must have at more than 0 total points
                // idk what happens if weighted category only has ec (ex. 10/0)
                if (category['Total'] !== 0) {
                    runningTotal += category['Score'] / category['Total'] * category['Weight']
                    weightTotal += category['Weight']
                }
            } else {
                runningScore += category['Score']
                runningTotal += category['Total']
            }
        }
    }
    let gradeNumer = !pointsBased ? runningTotal : runningScore
    let gradeDenom = !pointsBased ? weightTotal : runningTotal
    let grade = fixNan(gradeNumer / gradeDenom, 0)
    return [grade, gradeNumer, gradeDenom]
}

// create assignment grade inputs
function createAssignmentInput(id, catTitle, fieldName, initValue) {
    let gradeInput = document.createElement('input')
    gradeInput.value = initValue
    gradeInput.type = 'number'
    gradeInput.min = '0'
    gradeInput.style.width = '50px'
    gradeInput.oninput = () => {
        // make sure input is not negative, default to 0 if input field is empty
        if (gradeInput.value >= 0) {
            updateAssignment(id, catTitle, fieldName, gradeInput.value.length > 0 ? parseFloat(gradeInput.value) : 0)
        }
    }
    return gradeInput
}

// create html row for each assignment
function createAssignmentRow(assignmentData, categoryTable, categoryTitle, userAdded) {
    let assignmentRow = categoryTable.insertRow(-1)
    assignmentRow.id = assignmentData['ID'] // assignment id = id of assignment row

    // allow user to delete assignments
    let deleteButton = document.createElement('button')
    deleteButton.innerHTML = 'X'
    deleteButton.onclick = () => {
        deleteAssignment(assignmentData['ID'], categoryTitle)
    }
    assignmentRow.insertCell(0).appendChild(deleteButton)

    // assignment name, score/total input, and % grade
    assignmentRow.insertCell(1).innerHTML = assignmentData['Name']
    assignmentRow.insertCell(2).appendChild(createAssignmentInput(assignmentData['ID'], categoryTitle, 'Score', assignmentData['Score']))
    assignmentRow.insertCell(3).appendChild(createAssignmentInput(assignmentData['ID'], categoryTitle, 'Total', assignmentData['Total']))
    assignmentRow.insertCell(4).innerHTML = (assignmentData['Include'] ?
            ((assignmentData['Score'] / assignmentData['Total']) * 100).toFixed(2) : '-')
        + '%' // only calculate grade if assignment graded

    // allow user to reset original assignments to original score/total points
    let resetButton = document.createElement('button')
    resetButton.innerHTML = '⭯'
    resetButton.disabled = userAdded
    let score_original = assignmentData['Score']
    let total_original = assignmentData['Total']
    let include_original = assignmentData['Include']
    resetButton.onclick = () => {
        let assign = categoriesMap[categoryTitle]['Assignments'].find(assignment => assignment['ID'] === assignmentData['ID'])

        // if assignment was ungraded before we need to revert the category's score and total points
        if (!include_original && assign['Include']) {
            categoriesMap[categoryTitle]['Score'] -= assign['Score'] * assign['Multiplier']
            categoriesMap[categoryTitle]['Total'] -= assign['Total'] * assign['Multiplier']
            assign['Include'] = false
        } else { // otherwise, only the delta of the changed score/total is needed
            categoriesMap[categoryTitle]['Score'] += (score_original - assign['Score']) * assign['Multiplier']
            categoriesMap[categoryTitle]['Total'] += (total_original - assign['Total']) * assign['Multiplier']
        }
        // update assignment grade
        assign['Score'] = score_original
        assign['Total'] = total_original
        // update row with original grade
        let assignRow = document.getElementById(assignmentData['ID'])
        assignRow.children.item(2).children.item(0).value = score_original
        assignRow.children.item(3).children.item(0).value = total_original
        assignRow.children.item(4).innerHTML = (include_original ?
            ((assign['Score'] / assign['Total']) * 100).toFixed(2) : '-') + '%'

        refreshCategory(categoryTitle)
    }
    assignmentRow.insertCell(5).appendChild(resetButton)

    // display assignment teacher comments and point multiplier
    let moreInfo = ''
    moreInfo += assignmentData['Comments'] !== null ? (assignmentData['Comments']) : ''
    moreInfo += (assignmentData['Comments'] !== null && assignmentData['Multiplier'] !== 1) ? ', ' : ''
    moreInfo += assignmentData['Multiplier'] !== 1 ? ('Point Multiplier: ' + assignmentData['Multiplier']) : ''
    assignmentRow.insertCell(6).innerHTML = moreInfo
}

// remove element from array
Array.prototype.remove = function(from, to) {
    let rest = this.slice((to || from) + 1 || this.length)
    this.length = from < 0 ? this.length + from : from
    return this.push.apply(this, rest)
}

// + => green, - => red, 0 => black
function getDiffColor(num) {
    if (num > 0) {
        return '#1cef5b'
    } else if (num < 0) {
        return 'red'
    } else {
        return 'initial'
    }
}

// if number is NaN, replace it with specified string
function fixNan(input, replacement) {
    return isNaN(input) ? replacement : input;
}