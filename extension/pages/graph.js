// creates graph history graph
function loadGraph(graphData) {
    let categoriesData = JSON.parse(atob(graphData))

    // create empty categories data, build all assignments list
    let assignmentList = []
    let newCategories = {}
    for (let catName in categoriesData) {
        if (!categoriesData[catName]['Excluded']) { // don't include excluded category assignments
            newCategories[catName] = {
                'Score': 0,
                'Total': 0,
                'Weight': categoriesData[catName]['Weight'],
                'Points Based': categoriesData[catName]['Points Based'],
                'Excluded': false
            }
            for (let assign of categoriesData[catName]['Assignments']) {
                if (assign['Include']) {
                    assign['Category'] = catName
                    assignmentList.push(assign)
                }
            }
        }
    }
    // sort assignments by due date
    assignmentList.sort(((a, b) => {
        return Date.parse(a['Due Date']) - Date.parse(b['Due Date'])
    }))
    // console.log(assignmentList)

    // starting with empty categories data, add assignments one by one chronologically and calculate grade
    let gradeHistory = []
    let graphLabels = []
    //let consoleOut = []
    for (let assignment of assignmentList) {
        let category = newCategories[assignment['Category']]
        category['Score'] += assignment['Score'] * assignment['Multiplier']
        category['Total'] += assignment['Total'] * assignment['Multiplier']
        gradeHistory.push((calculateGrade(newCategories)[0] * 100).toFixed(2))
        graphLabels.push(assignment['Name'])
        //consoleOut.push([assignment['Name'], calcGrade(newCategories)])
    }
    /*console.log('after final iteration:')
    console.log(newCategories)
    console.log('grade history:')
    console.log(consoleOut)*/

    let darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // create graph using chart.js
    let ctx = document.getElementById('graph')
    // used to show different colors when grade increases/decreases
    let down = (ctx, value) => ctx.p0.parsed.y > ctx.p1.parsed.y ? value : undefined
    // show unpublished assignments with dotted line
    let dotted = (ctx, value) => graphLabels[ctx.p0DataIndex] === 'Unpublished Assignments' || graphLabels[ctx.p1DataIndex] === 'Unpublished Assignments' ? value : undefined

    Chart.defaults.color = darkMode ? 'rgb(245,245,245)' : 'rgb(0,0,0)'
    Chart.defaults.borderColor = darkMode ? 'rgb(60,60,60)' : 'rgb(0,0,0,0.1)'
    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graphLabels,
            datasets: [{
                label: 'Grade History',
                data: gradeHistory,
                borderColor: 'rgb(75, 192, 192)',
                segment: {
                    borderColor: ctx => dotted(ctx, darkMode ? 'rgb(120,120,120)' : 'rgb(0,0,0,0.4)') || down(ctx, 'rgb(192,75,75)'),
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