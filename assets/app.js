(function () {
  "use strict";

  const SERIES_VARS = [
    "--series-1", "--series-2", "--series-3", "--series-4",
    "--series-5", "--series-6", "--series-7", "--series-8",
  ];

  function seriesColor(index) {
    const varName = SERIES_VARS[index % SERIES_VARS.length];
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function formatPeriod(period) {
    if (period.length === 6) {
      return `${period.slice(0, 4)}년 ${parseInt(period.slice(4, 6), 10)}월`;
    }
    return `${period}년`;
  }

  function formatPeriodShort(period) {
    if (period.length === 6) {
      return `${period.slice(2, 4)}.${period.slice(4, 6)}`;
    }
    return period;
  }

  function formatNumber(value, unit) {
    const isCount = unit === "명" || unit === "건" || unit === "개";
    if (isCount && Math.abs(value) >= 100000000) {
      return `${(value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
    }
    if (isCount && Math.abs(value) >= 100000) {
      return `${(value / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
    }
    const decimals = Number.isInteger(value) ? 0 : 2;
    return value.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function formatFull(value, unit) {
    const decimals = Number.isInteger(value) ? 0 : 2;
    return value.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + unit;
  }

  function isIndexUnit(unit) {
    return unit.includes("=");
  }

  function displayUnitBadge(unit) {
    return isIndexUnit(unit) ? `(${unit})` : unit;
  }

  function formatDelta(delta, deltaPct, unit) {
    if (delta === null || delta === undefined) return { text: "변화 없음", cls: "flat" };
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "–";
    const isPercentUnit = unit === "%";
    const magnitude = isPercentUnit
      ? `${Math.abs(delta).toFixed(1)}%p`
      : isIndexUnit(unit)
        ? `${Math.abs(delta).toFixed(2)}p`
        : `${formatNumber(Math.abs(delta), unit)}${unit}`;
    const pctPart = !isPercentUnit && deltaPct !== null && deltaPct !== undefined
      ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`
      : "";
    return { text: `${arrow} ${magnitude}${pctPart}`, cls: dir };
  }

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step = span / (count - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(step || 1)));
    const residual = step / magnitude;
    let niceStep;
    if (residual > 5) niceStep = 10 * magnitude;
    else if (residual > 2) niceStep = 5 * magnitude;
    else if (residual > 1) niceStep = 2 * magnitude;
    else niceStep = magnitude;
    const niceMin = Math.floor(min / niceStep) * niceStep;
    const ticks = [];
    for (let v = niceMin; v <= max + niceStep * 0.001; v += niceStep) {
      ticks.push(Math.round(v * 1000) / 1000);
    }
    return ticks;
  }

  const tooltipEl = document.getElementById("tooltip");

  function showTooltip(x, y, periodText, valueText) {
    tooltipEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "tt-period";
    p.textContent = periodText;
    const v = document.createElement("p");
    v.className = "tt-value";
    v.textContent = valueText;
    tooltipEl.appendChild(p);
    tooltipEl.appendChild(v);
    tooltipEl.hidden = false;
    const rect = tooltipEl.getBoundingClientRect();
    let left = x + 14;
    let top = y - rect.height - 10;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top < 8) top = y + 18;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltipEl.hidden = true;
  }

  const W = 560, H = 200;
  const PAD = { top: 16, right: 14, bottom: 26, left: 54 };

  function buildLineChart(container, indicator, colorVar) {
    const series = indicator.series;
    const values = series.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const ticks = niceTicks(min, max, 4);
    const yMin = Math.min(ticks[0], min);
    const yMax = Math.max(ticks[ticks.length - 1], max);

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const xAt = (i) => PAD.left + (series.length === 1 ? 0 : (i / (series.length - 1)) * plotW);
    const yAt = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${indicator.name} 추이 차트`);

    // gridlines + y labels
    ticks.forEach((t) => {
      const y = yAt(t);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", PAD.left);
      line.setAttribute("x2", W - PAD.right);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--gridline)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", PAD.left - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "var(--text-muted)");
      label.textContent = formatNumber(t, indicator.unit);
      svg.appendChild(label);
    });

    // x labels: first and last
    [0, series.length - 1].forEach((i) => {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", i === 0 ? xAt(i) : xAt(i));
      label.setAttribute("y", H - 6);
      label.setAttribute("text-anchor", i === 0 ? "start" : "end");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "var(--text-muted)");
      label.textContent = formatPeriodShort(series[i].period);
      svg.appendChild(label);
    });

    // area fill
    let areaPath = `M ${xAt(0)} ${yAt(series[0].value)}`;
    series.forEach((d, i) => { areaPath += ` L ${xAt(i)} ${yAt(d.value)}`; });
    areaPath += ` L ${xAt(series.length - 1)} ${PAD.top + plotH} L ${xAt(0)} ${PAD.top + plotH} Z`;
    const area = document.createElementNS(svgNS, "path");
    area.setAttribute("d", areaPath);
    area.setAttribute("fill", `var(${colorVar})`);
    area.setAttribute("opacity", "0.1");
    area.setAttribute("stroke", "none");
    svg.appendChild(area);

    // line
    let linePath = `M ${xAt(0)} ${yAt(series[0].value)}`;
    series.forEach((d, i) => { if (i > 0) linePath += ` L ${xAt(i)} ${yAt(d.value)}`; });
    const line = document.createElementNS(svgNS, "path");
    line.setAttribute("d", linePath);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", `var(${colorVar})`);
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);

    // end marker
    const lastI = series.length - 1;
    const endDot = document.createElementNS(svgNS, "circle");
    endDot.setAttribute("cx", xAt(lastI));
    endDot.setAttribute("cy", yAt(series[lastI].value));
    endDot.setAttribute("r", "4");
    endDot.setAttribute("fill", `var(${colorVar})`);
    endDot.setAttribute("stroke", "var(--surface-1)");
    endDot.setAttribute("stroke-width", "2");
    svg.appendChild(endDot);

    // end direct label
    const endLabel = document.createElementNS(svgNS, "text");
    const nearRight = xAt(lastI) > W - PAD.right - 60;
    endLabel.setAttribute("x", nearRight ? xAt(lastI) - 8 : xAt(lastI) + 8);
    endLabel.setAttribute("y", yAt(series[lastI].value) - 8);
    endLabel.setAttribute("text-anchor", nearRight ? "end" : "start");
    endLabel.setAttribute("font-size", "12");
    endLabel.setAttribute("font-weight", "700");
    endLabel.setAttribute("fill", "var(--text-primary)");
    endLabel.textContent = formatNumber(series[lastI].value, indicator.unit);
    svg.appendChild(endLabel);

    // hover layer
    const crosshair = document.createElementNS(svgNS, "line");
    crosshair.setAttribute("y1", PAD.top);
    crosshair.setAttribute("y2", PAD.top + plotH);
    crosshair.setAttribute("stroke", "var(--baseline)");
    crosshair.setAttribute("stroke-width", "1");
    crosshair.setAttribute("visibility", "hidden");
    svg.appendChild(crosshair);

    const hoverDot = document.createElementNS(svgNS, "circle");
    hoverDot.setAttribute("r", "5");
    hoverDot.setAttribute("fill", `var(${colorVar})`);
    hoverDot.setAttribute("stroke", "var(--surface-1)");
    hoverDot.setAttribute("stroke-width", "2");
    hoverDot.setAttribute("visibility", "hidden");
    svg.appendChild(hoverDot);

    const overlay = document.createElementNS(svgNS, "rect");
    overlay.setAttribute("x", PAD.left);
    overlay.setAttribute("y", PAD.top);
    overlay.setAttribute("width", plotW);
    overlay.setAttribute("height", plotH);
    overlay.setAttribute("fill", "transparent");
    overlay.setAttribute("tabindex", "0");
    overlay.style.cursor = "crosshair";

    let currentIndex = lastI;

    function renderAt(index, clientX, clientY) {
      currentIndex = Math.max(0, Math.min(series.length - 1, index));
      const d = series[currentIndex];
      const x = xAt(currentIndex);
      const y = yAt(d.value);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("visibility", "visible");
      hoverDot.setAttribute("cx", x);
      hoverDot.setAttribute("cy", y);
      hoverDot.setAttribute("visibility", "visible");
      showTooltip(clientX, clientY, formatPeriod(d.period), formatFull(d.value, indicator.unit));
    }

    overlay.addEventListener("pointermove", (evt) => {
      const rect = svg.getBoundingClientRect();
      const relX = ((evt.clientX - rect.left) / rect.width) * W;
      const ratio = plotW === 0 ? 0 : (relX - PAD.left) / plotW;
      const index = Math.round(ratio * (series.length - 1));
      renderAt(index, evt.clientX, evt.clientY);
    });
    overlay.addEventListener("pointerleave", () => {
      crosshair.setAttribute("visibility", "hidden");
      hoverDot.setAttribute("visibility", "hidden");
      hideTooltip();
    });
    overlay.addEventListener("keydown", (evt) => {
      if (evt.key === "ArrowLeft") {
        evt.preventDefault();
        const rect = svg.getBoundingClientRect();
        const x = xAt(Math.max(0, currentIndex - 1));
        renderAt(currentIndex - 1, rect.left + (x / W) * rect.width, rect.top + rect.height / 2);
      } else if (evt.key === "ArrowRight") {
        evt.preventDefault();
        const rect = svg.getBoundingClientRect();
        const x = xAt(Math.min(series.length - 1, currentIndex + 1));
        renderAt(currentIndex + 1, rect.left + (x / W) * rect.width, rect.top + rect.height / 2);
      }
    });
    overlay.addEventListener("focus", () => {
      const rect = svg.getBoundingClientRect();
      const x = xAt(currentIndex);
      renderAt(currentIndex, rect.left + (x / W) * rect.width, rect.top + rect.height / 2);
    });
    overlay.addEventListener("blur", () => {
      crosshair.setAttribute("visibility", "hidden");
      hoverDot.setAttribute("visibility", "hidden");
      hideTooltip();
    });

    svg.appendChild(overlay);
    container.appendChild(svg);
  }

  function buildSparkline(indicator, colorVar) {
    const svgNS = "http://www.w3.org/2000/svg";
    const w = 140, h = 34;
    const series = indicator.series.slice(-12);
    const values = series.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const xAt = (i) => (series.length === 1 ? 0 : (i / (series.length - 1)) * w);
    const yAt = (v) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("aria-hidden", "true");

    let d = `M ${xAt(0)} ${yAt(values[0])}`;
    series.forEach((pt, i) => { if (i > 0) d += ` L ${xAt(i)} ${yAt(pt.value)}`; });
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--text-muted)");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", xAt(series.length - 1));
    dot.setAttribute("cy", yAt(values[values.length - 1]));
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", `var(${colorVar})`);
    svg.appendChild(dot);

    return svg;
  }

  function buildStatTile(indicator, index) {
    const colorVar = SERIES_VARS[index % SERIES_VARS.length];
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    tile.setAttribute("role", "listitem");

    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = indicator.name;
    tile.appendChild(label);

    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = formatNumber(indicator.latest_value, indicator.unit);
    const unit = document.createElement("span");
    unit.className = "stat-unit";
    unit.textContent = displayUnitBadge(indicator.unit);
    value.appendChild(unit);
    tile.appendChild(value);

    const meta = document.createElement("div");
    meta.className = "stat-meta";
    const delta = formatDelta(indicator.delta, indicator.delta_pct, indicator.unit);
    const deltaEl = document.createElement("span");
    deltaEl.className = `stat-delta ${delta.cls}`;
    deltaEl.textContent = delta.text;
    const periodEl = document.createElement("span");
    periodEl.className = "stat-period";
    periodEl.textContent = formatPeriod(indicator.latest_period);
    meta.appendChild(deltaEl);
    meta.appendChild(periodEl);
    tile.appendChild(meta);

    const spark = document.createElement("div");
    spark.className = "stat-sparkline";
    spark.appendChild(buildSparkline(indicator, colorVar));
    tile.appendChild(spark);

    return tile;
  }

  function buildChartCard(indicator, index) {
    const colorVar = SERIES_VARS[index % SERIES_VARS.length];
    const card = document.createElement("div");
    card.className = "chart-card";
    card.dataset.category = indicator.category;

    const head = document.createElement("div");
    head.className = "chart-card-head";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "chart-title";
    title.textContent = indicator.name;
    const sub = document.createElement("p");
    sub.className = "chart-sub";
    sub.textContent = `${indicator.category} · ${indicator.area} · ${indicator.period_type} · 단위 ${indicator.unit}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "chart-toggle";
    toggleBtn.textContent = "표로 보기";

    head.appendChild(titleWrap);
    head.appendChild(toggleBtn);
    card.appendChild(head);

    const svgWrap = document.createElement("div");
    svgWrap.className = "chart-svg-wrap";
    buildLineChart(svgWrap, indicator, colorVar);
    card.appendChild(svgWrap);

    const tableWrap = document.createElement("div");
    tableWrap.className = "chart-table-wrap";
    tableWrap.hidden = true;
    const table = document.createElement("table");
    table.className = "chart-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>시점</th><th>값</th></tr>`;
    const tbody = document.createElement("tbody");
    indicator.series.slice().reverse().forEach((d) => {
      const tr = document.createElement("tr");
      const tdP = document.createElement("td");
      tdP.textContent = formatPeriod(d.period);
      const tdV = document.createElement("td");
      tdV.textContent = formatFull(d.value, indicator.unit);
      tr.appendChild(tdP);
      tr.appendChild(tdV);
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);

    toggleBtn.addEventListener("click", () => {
      const showingTable = !tableWrap.hidden;
      tableWrap.hidden = showingTable;
      svgWrap.hidden = !showingTable;
      toggleBtn.textContent = showingTable ? "표로 보기" : "그래프로 보기";
    });

    return card;
  }

  function buildCategoryFilter(indicators, chartGrid) {
    const container = document.getElementById("category-filter");
    const categories = ["전체", ...Array.from(new Set(indicators.map((i) => i.category)))];
    categories.forEach((cat, i) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      chip.textContent = cat;
      chip.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      chip.addEventListener("click", () => {
        container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        chartGrid.querySelectorAll(".chart-card").forEach((card) => {
          card.style.display = cat === "전체" || card.dataset.category === cat ? "" : "none";
        });
      });
      container.appendChild(chip);
    });
  }

  function renderReleases(releases) {
    const tbody = document.getElementById("releases-tbody");
    const search = document.getElementById("release-search");

    function render(filter) {
      tbody.innerHTML = "";
      const q = filter.trim().toLowerCase();
      releases
        .filter((r) => !q || r.indicator_name.toLowerCase().includes(q))
        .forEach((r) => {
          const tr = document.createElement("tr");
          const cells = [r.indicator_name, r.area, r.unit, r.period];
          cells.forEach((c) => {
            const td = document.createElement("td");
            td.textContent = c;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
    }
    render("");
    search.addEventListener("input", () => render(search.value));
  }

  function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    const stored = localStorage.getItem("kosis-theme");
    if (stored) document.documentElement.dataset.theme = stored;
    toggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("kosis-theme", next);
    });
  }

  async function init() {
    initTheme();
    const res = await fetch("data/kosis_data.json");
    const data = await res.json();

    document.getElementById("updated-at").textContent =
      `데이터 갱신: ${new Date(data.generated_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;

    const statGrid = document.getElementById("stat-grid");
    data.indicators.forEach((ind, i) => statGrid.appendChild(buildStatTile(ind, i)));

    const chartGrid = document.getElementById("chart-grid");
    data.indicators.forEach((ind, i) => chartGrid.appendChild(buildChartCard(ind, i)));

    buildCategoryFilter(data.indicators, chartGrid);
    renderReleases(data.recent_releases);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
