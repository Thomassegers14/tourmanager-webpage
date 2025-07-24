/* global d3 */

// Locale voor getallen
d3.formatDefaultLocale({
    decimal: ',',
    thousands: '.',
    grouping: [3],
    currency: ['', '€']
});

Promise.all([
    d3.csv("ranking.csv", d3.autoType)
]).then(([rankData]) => {
    makeRankGraph(rankData);
});

function makeRankGraph(data) {
    const lastStage = d3.max(data, d => d.stage);
    document.getElementById("currentStage").textContent = lastStage;

    // Laatste stage-data en sortering deelnemers
    const lastStageData = data.filter(d => d.stage === lastStage);
    const sortedParticipants = lastStageData
        .sort((a, b) => d3.descending(a.total_points, b.total_points))
        .map(d => d.participant);

    // Responsive filtering
    const { width, height } = d3.select('.rankGraph').node().getBoundingClientRect();
    const isWide = width > 600;
    const margins = { top: 48, right: isWide ? 60 : 24, bottom: 48, left: 160 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;
    const heatmapPadding = 0.0;

    if (!isWide) {
        data = data.filter(d => d.stage > lastStage - 5);
    }

    // SVG setup
    const svg = d3.select('.rankGraph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margins.left}, ${margins.top})`);

    // X- en Y-schalen
    const xScale = d3.scaleBand()
        .range([0, innerWidth])
        .domain(data.map(d => d.stage))
        .padding(heatmapPadding);

    const yScale = d3.scaleBand()
        .range([0, innerHeight])
        .domain(sortedParticipants)
        .padding(heatmapPadding);

    // Assen
    svg.append('g')
        .attr('class', 'axis axis__x')
        .call(
            d3.axisTop(xScale)
                .tickPadding(12)
                .tickSizeOuter(0)
                .tickSize(-0)
                .tickFormat(x => `stage ${x}`)
        )
        .selectAll("text")
        .attr("dx", 24)
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    svg.append('g')
        .attr('class', 'axis axis__y')
        .call(
            d3.axisLeft(yScale)
                .tickPadding(12)
                .tickSizeOuter(0)
                .tickSize(-innerWidth)
        );

    d3.selectAll(".axis").selectAll(".domain").remove();

    // Renders heatmap rects en labels
    function renderCells() {
        svg.selectAll("rect")
            .data(data, d => d.participant + ':' + d.stage)
            .join("rect")
            .attr("x", d => xScale(d.stage))
            .attr("y", d => yScale(d.participant))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth());

        svg.selectAll(".rankText")
            .data(data, d => d.participant + ':' + d.stage)
            .join("text")
            .attr("class", "rankText")
            .attr("x", d => xScale(d.stage) + xScale.bandwidth() / 2)
            .attr("y", d => yScale(d.participant) + yScale.bandwidth() / 2 + 3)
            .attr("text-anchor", "middle")
            .text(d => d.rank);

        svg.selectAll(".totalText")
            .data(lastStageData)
            .join("text")
            .attr("class", "totalText")
            .attr("x", d => xScale(d.stage) + xScale.bandwidth() + 6)
            .attr("y", d => yScale(d.participant) + 16)
            .attr("text-anchor", "start")
            .text(d => `${Math.round(d.total_points)} pts`);
    }

    renderCells();
    updateColors('rank');

    // Dynamisch event listeners voor alle knoppen
    d3.selectAll(".colorModeToggle button").on("click", function () {
        const metric = d3.select(this).attr("data-color");
        updateColors(metric);
    })

    // Kleurupdatefunctie
    function updateColors(metric) {
        const extent = metric === 'rank' ?
            d3.extent(data, d => d[metric]).reverse()
            : [0, d3.max(data, d => d[metric])]

        const colorScale = d3.scaleSequential()
            .domain(extent)
            .interpolator(d3.interpolateViridis);

        svg.selectAll("rect")
            .transition()
            .duration(500)
            .style("fill", d => colorScale(d[metric]));

        svg.selectAll(".rankText")
            .transition()
            .duration(500)
            .text(d => d[metric]);

        d3.selectAll(".colorModeToggle button").classed("active", false);
        const idMap = {
            rank: "colorByRank",
            points: "colorByPoints",
            total_points: "colorByTotalPoints"
        };
        d3.select(`#${idMap[metric]}`).classed("active", true);


        updateLegend(colorScale, metric);
    }

    // Legenda
    function updateLegend(colorScale, metric) {
        const legendSvg = d3.select("#legendSvg");
        const { width, height } = legendSvg.node().getBoundingClientRect();
        const legendWidth = width * 0.9;
        const legendHeight = height * 0.4;

        legendSvg.selectAll("*").remove();

        const defs = legendSvg.append("defs");
        const gradient = defs.append("linearGradient").attr("id", "legend-gradient");

        gradient.selectAll("stop")
            .data(d3.range(0, 1.01, 0.01))
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => colorScale(d3.interpolateNumber(...colorScale.domain())(d)));

        legendSvg.append("rect")
            .attr("x", 20)
            .attr("y", 8)
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)");

        const legendScale = d3.scaleLinear()
            .domain(colorScale.domain())
            .range([20, 20 + legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickSize(-legendHeight)
            .tickFormat(d => metric === 'rank' ? `#${d}` : `${Math.round(d)} pts`);

        legendSvg.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(0, ${8 + legendHeight})`)
            .call(legendAxis)

                d3.selectAll(".legend-axis").selectAll(".domain").remove();

    }
}
