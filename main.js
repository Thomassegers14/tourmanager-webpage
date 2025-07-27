/* global d3 */

// Locale voor getallen
d3.formatDefaultLocale({
    decimal: ',',
    thousands: '.',
    grouping: [3],
    currency: ['', '€']
});

let rankingData = null;
let analyseData = null;

Promise.all([
    d3.csv("ranking.csv", d3.autoType),
    d3.csv("analyse.csv", d3.autoType)
]).then(([rank, analyse]) => {
    rankingData = rank;
    analyseData = analyse;
    initTabs();
});

let columnWidth;

function getGridColumnWidth(containerSelector, nSelected) {
    const container = document.querySelector(containerSelector);
    const containerWidth = container.getBoundingClientRect().width;

    // Lees de computed style uit om de gap tussen kolommen op te halen
    const style = window.getComputedStyle(container);
    const gap = parseFloat(style.columnGap || style.gap || 0);

    // Tel hoeveel kolommen er zijn aan de hand van berekening
    // Zoek het aantal kolommen door een tijdelijke rij vol te proppen
    const probe = document.createElement('div');
    probe.style.width = '100%';
    probe.style.display = 'contents'; // wordt zelf niet gerenderd

    // Voeg child-elementen toe om kolommen te forceren
    const items = [];
    for (let i = 0; i < nSelected; i++) {
        const item = document.createElement('div');
        item.textContent = i + 1;
        item.style.height = '1px';
        item.style.background = 'red';
        item.style.gridColumn = 'auto';
        items.push(item);
        probe.appendChild(item);
    }

    container.appendChild(probe);

    // Bepaal hoeveel kolommen er effectief zijn ontstaan
    const columns = new Set();
    for (const item of items) {
        const left = item.getBoundingClientRect().left;
        columns.add(left); // unieke x-posities
    }

    const numberOfColumns = columns.size;
    container.removeChild(probe);

    if (numberOfColumns === 0) return null;

    const totalGapWidth = gap * (numberOfColumns - 1);
    const totalColumnWidth = containerWidth - totalGapWidth;
    const columnWidth = totalColumnWidth / numberOfColumns;

    return `${columnWidth - 12}`;
}

// -----------------------------
// Navigatie & Tabs
// -----------------------------
const tabs = {
    ranking: {
        elementId: 'tab-ranking',
        initialized: false,
        init: () => {
            if (!tabs.ranking.initialized) {
                makeRankGraph(rankingData);
                tabs.ranking.initialized = true;
            }
        }
    },
    analyse: {
        elementId: 'tab-analyse',
        initialized: false,
        init: () => {
            if (!tabs.analyse.initialized) {
                makeAnalyseGraph(analyseData);
                tabs.analyse.initialized = true;
            }
        }
    }
};

const initTabs = () => {
    const hash = location.hash.replace('#', '') || 'ranking';
    switchTab(hash);

    window.addEventListener('hashchange', () => {
        const tabName = location.hash.replace('#', '');
        switchTab(tabName);
    });
};

const switchTab = (tabName) => {
    Object.entries(tabs).forEach(([key, tab]) => {
        const el = document.getElementById(tab.elementId);
        if (el) el.style.display = key === tabName ? 'block' : 'none';
    });

    document.querySelectorAll('.navLink').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${tabName}`);
    });

    if (tabs[tabName]) tabs[tabName].init();
};

// -----------------------------
// Ranking Graph
// -----------------------------
function makeRankGraph(data) {
    const lastStage = d3.max(data, d => d.stage);
    document.getElementById("currentStage").textContent = lastStage;

    const lastStageData = data.filter(d => d.stage === lastStage);
    const sortedParticipants = lastStageData
        .sort((a, b) => d3.descending(a.total_points, b.total_points))
        .map(d => d.participant);

    const { width, height } = d3.select('.rankGraph').node().getBoundingClientRect();
    const isWide = width > 600;
    const margins = { top: 48, right: isWide ? 60 : 24, bottom: 48, left: 160 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    if (!isWide) data = data.filter(d => d.stage > lastStage - 5);

    const svg = d3.select('.rankGraph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margins.left}, ${margins.top})`);

    const xScale = d3.scaleBand()
        .range([0, innerWidth])
        .domain(data.map(d => d.stage))
        .padding(0);

    const yScale = d3.scaleBand()
        .range([0, innerHeight])
        .domain(sortedParticipants)
        .padding(0);

    svg.append('g')
        .attr('class', 'axis axis__x')
        .call(
            d3.axisTop(xScale)
                .tickPadding(12)
                .tickSize(0)
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
                .tickSize(-innerWidth)
        );

    d3.selectAll(".axis").selectAll(".domain").remove();

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

    d3.selectAll(".colorModeToggle button").on("click", function () {
        const metric = d3.select(this).attr("data-color");
        updateColors(metric);
    });

    function updateColors(metric) {
        const extent = metric === 'rank'
            ? d3.extent(data, d => d[metric]).reverse()
            : [0, d3.max(data, d => d[metric])];

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

    function updateLegend(colorScale, metric) {
        const legendSvg = d3.select("#legendSvg");
        const { width, height } = legendSvg.node().getBoundingClientRect();
        const legendWidth = width * 0.9;
        const legendHeight = height - 24

        legendSvg.selectAll("*").remove();

        const defs = legendSvg.append("defs");
        const gradient = defs.append("linearGradient").attr("id", "legend-gradient");

        gradient.selectAll("stop")
            .data(d3.range(0, 1.01, 0.01))
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => colorScale(d3.interpolateNumber(...colorScale.domain())(d)));

        legendSvg.append("rect")
            .attr("x", 12)
            .attr("y", 12)
            .attr("width", legendWidth)
            .attr("height", legendHeight / 2)
            .style("fill", "url(#legend-gradient)");

        const legendScale = d3.scaleLinear()
            .domain(colorScale.domain())
            .range([8, 8 + legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickSize(-legendHeight / 2)
            .tickFormat(d => metric === 'rank' ? `#${d}` : `${Math.round(d)} pts`);

        legendSvg.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(6, ${legendHeight})`)
            .call(legendAxis);

        d3.selectAll(".legend-axis").selectAll(".domain").remove();

    }
}

// -----------------------------
// Analyse Graph
// -----------------------------
function makeAnalyseGraph(data) {
    const stageIds = Array.from(new Set(data.map(d => d.stage))).sort((a, b) => a - b);
    const lastStage = d3.max(stageIds);
    const riderNames = Array.from(new Set(data.map(d => d.rider_name)));

    const participants = Array.from(new Set(data.map(d => d.participant)));

    const participantsSorted = Array.from(
        d3.rollup(
            data.filter(d => d.stage === lastStage),
            v => d3.sum(v, d => d.total_points),
            d => d.participant
        )
    ).sort((a, b) => d3.descending(a[1], b[1])).map(d => d[0]);

    const uniqueScores = Array.from(
        d3.rollup(
            data.filter(d => d.stage === lastStage & d.total_points > 0),
            v => v[0].total_points, // neem eerste voorkomens
            d => d.rider_name
        )
    )

    const topRiders = Array.from(uniqueScores)
        .sort((a, b) => d3.descending(a[1], b[1]))
        .slice(0, 6)
        .map(d => d[0])

    const colorScale = d3.scaleOrdinal()
        .domain(topRiders)
        .range(["#6D7991", "#4D5066", "#FFF0B0", "#FFDA6D", "#FFAA00", "#FFAA00"].reverse())

    const dropdown = d3.select("#multiSelectDropdown");

    // Vul dropdown met vinkjes
    participants.forEach(participant => {
        const label = dropdown.append("label");
        label.append("input")
            .attr("type", "checkbox")
            .attr("value", participant)
            .property("checked", true);
        label.append("span").text(" " + participant);
    })

    // Selecteer alles
    d3.select("#selectAllBtn").on("click", () => {
        dropdown.selectAll("input[type='checkbox']")
            .property("checked", true);
        updateSelection(); // << herteken grafiek met ALLE deelnemers
    });

    // Deselecteer alles
    d3.select("#deselectAllBtn").on("click", () => {
        dropdown.selectAll("input[type='checkbox']")
            .property("checked", false);
        updateSelection(); // << herteken grafiek met GEEN deelnemers
    });

    dropdown.selectAll("input").on("change", updateSelection);

    document.getElementById("multiSelectBtn").addEventListener("click", () => {
        dropdown.style("display", dropdown.style("display") === "block" ? "none" : "block");
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest('.multiSelectWrapper')) {
            dropdown.style("display", "none");
        }
    });

    d3.select("#participantSelect")
        .selectAll("option.participantOption")
        .data(participantsSorted)
        .join("option")
        .attr("class", "participantOption")
        .attr("value", d => d)
        .text(d => d);

    d3.select("#participantSelect").on("change", () => {
        const selected = Array.from(d3.select("#participantSelect").node()).map(d => d.value);
        updateSelection(selected.length ? selected : []);
    });

    updateSelection();

    document.getElementById("toggleStackMode")?.addEventListener("change", () => {
        updateSelection();
    });


    function updateSelection(forced = null) {
        selected = dropdown
            .selectAll("input[type='checkbox']")
            .filter(function () {
                return this.checked;
            })
            .nodes()
            .map(cb => cb.value)

        // Bepaal de laatste stage
        const lastStage = d3.max(data, d => d.stage);

        // Bepaal de totale punten per geselecteerde deelnemer bij laatste stage
        selected.sort((a, b) => {
            const totalA = d3.sum(
                data.filter(d => d.participant === a && d.stage === lastStage),
                d => d.total_points
            );
            const totalB = d3.sum(
                data.filter(d => d.participant === b && d.stage === lastStage),
                d => d.total_points
            );
            return d3.descending(totalA, totalB);
        });

        render(selected);
    }

    function getLastName(fullName) {
        const parts = fullName.trim().split(" ");
        const lastNameParts = [];
        for (const part of parts) {
            if (part === part.toUpperCase()) lastNameParts.push(part);
            else break;
        }
        return lastNameParts.length ? lastNameParts.join(" ") : fullName;
    }

    function render(participantsToShow) {
        d3.select("#analyseGraph").html("");

        const container = d3.select("#analyseGraph")
        colWidth = getGridColumnWidth('.analyseGraphGrid', participantsToShow.length)

        participantsToShow.forEach(participant => {
            const participantData = data.filter(d => d.participant === participant);

            const riderOrder = Array.from(
                d3.rollup(
                    participantData.filter(d => d.stage === lastStage),
                    v => d3.median(v, d => d.total_points),
                    d => d.rider_name
                )
            ).sort((a, b) => d3.descending(a[1], b[1])).map(d => d[0])

            // Weekly summary per participant
            const stagesPerWeek = 7;
            const weeklyGroups = d3.groups(participantData, d => Math.floor((d.stage - 1) / stagesPerWeek) + 1);

            const weeklyStats = weeklyGroups.map(([week, values]) => ({
                week,
                totalPoints: d3.sum(values, d => d.points)
            }))            

            const bestWeek = d3.max(weeklyStats, d => d.totalPoints);
            const best = weeklyStats.find(d => d.totalPoints === bestWeek)?.week;

            const worstWeek = d3.min(weeklyStats, d => d.totalPoints);
            const worst = weeklyStats.find(d => d.totalPoints === worstWeek)?.week;

            const nested = stageIds.map(stage => {
                const stageData = participantData.filter(d => d.stage === stage);
                const entry = { stage };
                riderNames.forEach(r => entry[r] = 0);
                stageData.forEach(d => entry[d.rider_name] = d.total_points);
                return entry;
            });

            const usePercent = document.getElementById("toggleStackMode")?.checked;

            const stack = d3.stack()
                .keys(riderOrder)
                .order(d3.stackOrderNone)
                .offset(usePercent ? d3.stackOffsetExpand : d3.stackOffsetNone);

            const stackedData = stack(nested);

            const width = colWidth;
            const height = 320;
            const margin = { top: 48, right: 60, bottom: 48, left: 32 };

            const x = d3.scaleLinear()
                .domain(d3.extent(stageIds))
                .range([margin.left, width - margin.right]);

            const yMax = Math.ceil(d3.max(stackedData, layer => d3.max(layer, d => d[1])) / 200) * 200;

            const y = d3.scaleLinear()
                .domain([0, usePercent ? 1 : yMax])
                .range([height - margin.bottom, margin.top]);

            const area = d3.area()
                .x(d => x(d.data.stage))
                .y0(d => y(d[0]))
                .y1(d => y(d[1]));

            const svg = container.append("svg")
                .attr("width", width)
                .attr("height", height)

            const crosshair = svg.append("line")
                .attr("class", "crosshair")
                .attr("y1", margin.top)
                .attr("y2", height - margin.bottom)
                .attr("visibility", "hidden")

            const tooltip = d3.select("#globalTooltip");

            const tickWidth = x(lastStage) - margin.left;

            svg.append("g")
                .attr("transform", `translate(${margin.left},0)`)
                .call(
                    d3.axisLeft(y)
                        .ticks(4)
                        .tickSizeInner(-tickWidth)
                        .tickFormat(d => usePercent ? `${Math.round(d * 100)}%` : d)
                )
                .attr("class", "axis")
                .call(g => g.select(".domain").remove());


            svg.selectAll(".area")
                .data(stackedData)
                .join("path")
                .attr("class", "area")
                .attr("fill", d => topRiders.includes(d.key) ? colorScale(d.key) : "#969fb5ff")
                .attr("stroke", d => topRiders.includes(d.key) ? colorScale(d.key) : "#b2b9ccff")
                .attr("d", area)

            svg.selectAll(".rider-label")
                .data(stackedData)
                .join("text")
                .filter(d => {
                    const last = d[d.length - 1];
                    return Math.abs(y(last[0]) - y(last[1])) > 8;
                })
                .attr("class", "rider-label")
                .attr("x", width - margin.right + 4)
                .attr("y", d => {
                    const last = d[d.length - 1];
                    return (y(last[0]) + y(last[1])) / 2;
                })
                .attr("dy", "0.35em")
                .attr("font-size", "0.65rem")
                .attr("fill", d => topRiders.includes(d.key) ? colorScale(d.key) : "lightgrey")
                .text(d => getLastName(d.key))

            svg.append("g")
                .attr("transform", `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(x).tickFormat(d => `s${d}`).ticks(5))
                .attr("font-size", "0.7rem");

            // Overlay voor interactie
            svg.append("rect")
                .attr("class", "overlay")
                .attr("x", margin.left)
                .attr("y", margin.top)
                .attr("width", width - margin.left - margin.right)
                .attr("height", height - margin.top - margin.bottom)
                .attr("fill", "transparent")
                .on("mousemove", function (event) {
                    const [xm] = d3.pointer(event);
                    const stageNum = Math.round(x.invert(xm));

                    crosshair
                        .attr("x1", x(stageNum))
                        .attr("x2", x(stageNum))
                        .attr("visibility", "visible");

                    const stageData = nested.find(d => d.stage === stageNum);
                    if (!stageData) return;

                    const tooltipHTML = Object.entries(stageData)
                        .filter(([key]) => key !== "stage")
                        .filter(([_, val]) => val > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([rider, val]) => {
                            return `<div><strong>${getLastName(rider)}</strong>: ${Math.round(val)} pts</div>`;
                        }).join("");

                    tooltip
                        .style("display", "block")
                        .style("left", (event.pageX + 12) + "px")
                        .style("top", (event.pageY + 12) + "px")
                        .html(`<div><strong>Stage ${stageNum}</strong></div>${tooltipHTML}`);
                })
                .on("mouseleave", () => {
                    crosshair.attr("visibility", "hidden");
                    tooltip.style("display", "none");
                })
                .on("mouseleave", () => {
                    crosshair.attr("visibility", "hidden");
                    tooltip.style("display", "none");
                })

            // Add summary text
            const summary = svg.append("g")
                .attr("transform", `translate(${margin.left}, ${height - margin.bottom + 24})`);

            summary.append("text")
                .attr("class", "summary-text")
                .attr("dy", "1em")
                .text(`Beste week: ${best}  •  Zwakste: ${worst}`);

            // Bereken totaal aantal punten voor de laatste stage
            const totalPointsLastStage = d3.sum(
                participantData.filter(d => d.stage === lastStage),
                d => d.total_points
            );

            // Voeg titel toe met participant en totaal
            svg.append("text")
                .attr("x", margin.left)
                .attr("y", margin.top - 24)
                .attr("class", "area-title")
                .text(participant);

            svg.append("text")
                .attr("x", margin.left)
                .attr("y", margin.top - 10)
                .attr("class", "area-subtitle")
                .text(`${Math.round(totalPointsLastStage)} pts`);


        });

        const legend = d3.select("#analyseLegend")
        legend.html("")

        legend.selectAll(".legend-item")
            .data(topRiders)
            .join("div")
            .attr("class", "legend-item")
            .html(d => `
                <span class="legend-swatch" style="background-color:${colorScale(d)}"></span>
                <span>${d}</span>
            `)
    }
}

// -----------------------------
// Hamburger menu
// -----------------------------
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navMenu = document.getElementById('navMenu');

hamburgerBtn.addEventListener('click', () => {
    navMenu.classList.toggle('open');
});

document.querySelectorAll('.navLink').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('open');
    });
});

document.addEventListener('click', (event) => {
    const isClickInside = navMenu.contains(event.target) || hamburgerBtn.contains(event.target);
    if (!isClickInside) {
        navMenu.classList.remove('open');
    }
});
