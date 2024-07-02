/* global d3 */

// Formatting numbers
d3.formatDefaultLocale({
    decimal: ',',
    thousands: '.',
    grouping: [3],
    currency: ['', '€']
})
  
Promise.all([
    d3.csv("ranking.csv", d3.autoType)
])
.then(([rankData]) => {
    // plot all data
    makeRankGraph(rankData)
})

const makeRankGraph = function(data) {

    const lastStage = d3.max(data, d => d.stage)
    document.getElementById("currentStage").textContent = lastStage;

    // set outer dimensions
    const { width, height } = d3.select('.rankGraph').node().getBoundingClientRect()

    // set the dimensions and margins of the graph
    const margins = { top: 48, right: width > 600 ? 180 : 120, bottom: 48, left: 26 }

    data = width > 600 ? data : data.filter(d => d.stage > lastStage - 5)

    // set inner dimensions
    const innerWidth = width - margins.left - margins.right
    const innerHeight = height - margins.top - margins.bottom

    // append the svg object to the body of the page
    const svg = d3.select('.rankGraph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margins.left}, ${margins.top})`)

    // Build X scales and axis:
    const xScale = d3.scaleLinear()
    .range([0, innerWidth])
    .domain([d3.min(data, d => d.stage), lastStage])

    svg.append('g')
    .attr('class', 'axis axis__x')
    .call(
        d3.axisTop(xScale)
        // .ticks(width > 600 ? lastStage : 5)
        .ticks(2)
        .tickPadding(12)
        .tickSizeOuter(0)
        .tickSize(-innerHeight)
        .tickFormat(x => `stage ${x}`)
        )
    .selectAll("text")  
    .attr("dx", 24)
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");

    // Build Y scales and axis:
    const yScale = d3.scaleLinear()
    .range([0, innerHeight])
    .domain(d3.extent(data, d => d.rank))

    svg.append('g')
    .attr('class', 'axis axis__y')
    .call(
        d3.axisLeft(yScale)
        .ticks(40)
        .tickPadding(12)
        .tickSizeOuter(0)
        .tickSize(-innerWidth)
        )
    
    d3.selectAll(".axis").selectAll(".domain").remove()

    svg.selectAll("rankLine")
    .data(d3.group(data, d => d.participant))
    .join("path")
    .attr("clip-path", "url(#clip)")
    .attr("class", `rankLine`)
    .attr("d", d => {
        return d3.line()
          .x(d => xScale(+d.stage))
          .y(d => yScale(+d.rank))(d[1]);
        })

    svg.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "rankDot")
    .attr("cx", d => xScale(+d.stage))
    .attr("cy", d => yScale(+d.rank))
    .attr("r", width > 400 ? 5 : 4)

    
    svg.selectAll("rankText")
    .data(data.filter(d => d.stage == d3.max(data, e => e.stage)))
    .join("text")
    .attr("class", "rankText")
    .attr("x", d => xScale(d.stage))
    .attr("y", d => yScale(d.rank))
    .html(d => d.participant)
    .attr("text-anchor","start")
    .attr("dx", 12)
    .attr("dy", 3)

    svg.selectAll("rankPoints")
    .data(data.filter(d => d.stage == d3.max(data, e => e.stage)))
    .join("text")
    .attr("class", "rankText rankText--points")
    .attr("x", d => xScale(d.stage))
    .attr("y", d => yScale(d.rank))
    .html(d => `${Math.round(d.total_points)} pts`)
    .attr("text-anchor","start")
    .attr("dx", 12)
    .attr("dy", 16)

}