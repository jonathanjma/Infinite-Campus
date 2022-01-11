// graph page: shows grade trend graph
function loadGraph(graphData) {
categoriesData = JSON.parse(atob(graphData)) // decode base64
console.log('from url:')
console.log(categoriesData)


// create empty categories data, build all assignments list
let assignmentList = []
let newCategories = {}
let pointsBased = false
for (let catName in categoriesData) {
    pointsBased = categoriesData[catName]['Points Based']
    newCategories[catName] = {
        'Score': 0,
        'Total': 0,
        'Weight': categoriesData[catName]['Weight'],
    }
    for (let assign of categoriesData[catName]['Assignments']) {
        if (assign['Include']) {
            assign['Category'] = catName
            assignmentList.push(assign)
        }
    }
}
// sort assignments by due date
assignmentList.sort(((a, b) => {
    return Date.parse(a['Due Date']) - Date.parse(b['Due Date'])
}))
// console.log(assignmentList)

// calculate grade with given categories data
function calcGrade(categories) {
    let weightTotal = 0 // needed if categories have no assignments
    let runningScore = 0, runningTotal = 0

    for (let catName in categories) {
        let category = categories[catName]
        if (!pointsBased) { // has weighted categories
            if (category['Total'] !== 0) { // categories must have at more than 0 total points
                runningTotal += (category['Score'] / category['Total']) * category['Weight']
                weightTotal += category['Weight']
            }
        } else {
            runningScore += category['Score']
            runningTotal += category['Total']
        }
    }

    let gradeNumer = !pointsBased ? runningTotal : runningScore
    let gradeDenom = !pointsBased ? weightTotal : runningTotal
    return parseFloat(((gradeNumer / gradeDenom) * 100).toFixed(2))
}

// starting with empty categories data, add assignments one by one chronologically and calculate grade
let gradeHistory = []
let graphLabels = []
let consoleOut = []
for (let assignment of assignmentList) {
    let category = newCategories[assignment['Category']]
    category['Score'] += assignment['Score'] * assignment['Multiplier']
    category['Total'] += assignment['Total'] * assignment['Multiplier']
    gradeHistory.push(calcGrade(newCategories))
    graphLabels.push(assignment['Name'])
    consoleOut.push([assignment['Name'], calcGrade(newCategories)])
}
console.log('after final iteration:')
console.log(newCategories)
console.log('grade history:')
console.log(consoleOut)

// create graph using chart.js
let ctx = document.getElementById('graph')
// used to show different colors when grade increases/decreases
let down = (ctx, value) => ctx.p0.parsed.y > ctx.p1.parsed.y ? value : undefined
// show unpublished assignments with dotted line
let dotted = (ctx, value) => graphLabels[ctx.p0DataIndex] === 'Unpublished Assignments' || graphLabels[ctx.p1DataIndex] === 'Unpublished Assignments' ? value : undefined

Chart.defaults.color = 'rgb(0, 0, 0)'
let chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: graphLabels,
        datasets: [{
            label: className + 'Grade History',
            data: gradeHistory,
            borderColor: 'rgb(75, 192, 192)',
            segment: {
                borderColor: ctx => dotted(ctx, 'rgb(0,0,0,0.2)') || down(ctx, 'rgb(192,75,75)'),
                borderDash: ctx => dotted(ctx, [6, 6]),
            },
            tension: 0.1
        }]
    },
    options: {
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Assignments',
                    font: {
                        size: 15,
                        weight: 'bold'
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Grade %',
                    font: {
                        size: 15,
                        weight: 'bold'
                    }
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Grade History',
                font: {
                    size: 30
                }
            },
            legend: {
                display: false
            }
        },
        interaction: {
            intersect: false
        },
        radius: 0,
    },
})
}