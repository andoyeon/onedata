/* Common line-chart component — PROJECT_SPEC.md 섹션 4-3 */
window.RenderCharts = (function () {
  "use strict";

  const { formatNumber, formatFull, formatPeriod } = window.RenderCards;

  const W = 560, H = 200;
  const PAD = { top: 16, right: 14, bottom: 26, left: 54 };

  function formatPeriodShort(period) {
    if (period.length === 6) {
      return `${period.slice(2, 4)}.${period.slice(4, 6)}`;
    }
    return period;
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

  let tooltipEl = null;
  function getTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.getElementById("tooltip");
    }
    return tooltipEl;
  }

  function showTooltip(x, y, periodText, valueText) {
    const el = getTooltip();
    if (!el) return;
    el.innerHTML = "";
    const p = document.createElement("p");
    p.className = "tt-period";
    p.textContent = periodText;
    const v = document.createElement("p");
    v.className = "tt-value";
    v.textContent = valueText;
    el.appendChild(p);
    el.appendChild(v);
    el.hidden = false;
    const rect = el.getBoundingClientRect();
    let left = x + 14;
    let top = y - rect.height - 10;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top < 8) top = y + 18;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function hideTooltip() {
    const el = getTooltip();
    if (el) el.hidden = true;
  }

  /**
   * Render an SVG line chart into `container`.
   * @param {HTMLElement} container
   * @param {object} indicator {name, unit, series}
   * @param {string} accentColor CSS color value (e.g. "var(--accent-market)")
   */
  function renderLineChart(container, indicator, accentColor) {
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

    ticks.forEach((t) => {
      const y = yAt(t);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", PAD.left);
      line.setAttribute("x2", W - PAD.right);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--border)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", PAD.left - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "var(--text-secondary)");
      label.textContent = formatNumber(t, indicator.unit);
      svg.appendChild(label);
    });

    [0, series.length - 1].forEach((i) => {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", xAt(i));
      label.setAttribute("y", H - 6);
      label.setAttribute("text-anchor", i === 0 ? "start" : "end");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "var(--text-secondary)");
      label.textContent = formatPeriodShort(series[i].period);
      svg.appendChild(label);
    });

    let areaPath = `M ${xAt(0)} ${yAt(series[0].value)}`;
    series.forEach((d, i) => { areaPath += ` L ${xAt(i)} ${yAt(d.value)}`; });
    areaPath += ` L ${xAt(series.length - 1)} ${PAD.top + plotH} L ${xAt(0)} ${PAD.top + plotH} Z`;
    const area = document.createElementNS(svgNS, "path");
    area.setAttribute("d", areaPath);
    area.setAttribute("fill", accentColor);
    area.setAttribute("opacity", "0.1");
    area.setAttribute("stroke", "none");
    svg.appendChild(area);

    let linePath = `M ${xAt(0)} ${yAt(series[0].value)}`;
    series.forEach((d, i) => { if (i > 0) linePath += ` L ${xAt(i)} ${yAt(d.value)}`; });
    const line = document.createElementNS(svgNS, "path");
    line.setAttribute("d", linePath);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", accentColor);
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);

    const lastI = series.length - 1;
    const endDot = document.createElementNS(svgNS, "circle");
    endDot.setAttribute("cx", xAt(lastI));
    endDot.setAttribute("cy", yAt(series[lastI].value));
    endDot.setAttribute("r", "4");
    endDot.setAttribute("fill", accentColor);
    endDot.setAttribute("stroke", "var(--surface)");
    endDot.setAttribute("stroke-width", "2");
    svg.appendChild(endDot);

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

    const crosshair = document.createElementNS(svgNS, "line");
    crosshair.setAttribute("y1", PAD.top);
    crosshair.setAttribute("y2", PAD.top + plotH);
    crosshair.setAttribute("stroke", "var(--text-secondary)");
    crosshair.setAttribute("stroke-width", "1");
    crosshair.setAttribute("visibility", "hidden");
    svg.appendChild(crosshair);

    const hoverDot = document.createElementNS(svgNS, "circle");
    hoverDot.setAttribute("r", "5");
    hoverDot.setAttribute("fill", accentColor);
    hoverDot.setAttribute("stroke", "var(--surface)");
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

  function buildTable(indicator) {
    const table = document.createElement("table");
    table.className = "chart-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>시점</th><th>값</th></tr>";
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
    return table;
  }

  /**
   * Build a full chart card (title, chart, table-view toggle).
   * @param {object} indicator
   * @param {string} accentColor CSS color value
   * @param {string} categoryLabel shown in the card subtitle
   */
  function renderChartCard(indicator, accentColor, categoryLabel, sourceLabel) {
    const card = document.createElement("div");
    card.className = "card chart-card";
    card.dataset.category = indicator.category;

    const head = document.createElement("div");
    head.className = "chart-card-head";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "chart-title";
    title.textContent = indicator.name;
    if (sourceLabel) {
      const badge = document.createElement("span");
      badge.className = "source-badge";
      badge.textContent = sourceLabel;
      title.appendChild(document.createTextNode(" "));
      title.appendChild(badge);
    }
    const sub = document.createElement("p");
    sub.className = "chart-sub";
    sub.textContent = `${categoryLabel} · ${indicator.area} · ${indicator.period_type} · 단위 ${indicator.unit}`;
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
    renderLineChart(svgWrap, indicator, accentColor);
    card.appendChild(svgWrap);

    const tableWrap = document.createElement("div");
    tableWrap.className = "chart-table-wrap";
    tableWrap.hidden = true;
    tableWrap.appendChild(buildTable(indicator));
    card.appendChild(tableWrap);

    toggleBtn.addEventListener("click", () => {
      const showingTable = !tableWrap.hidden;
      tableWrap.hidden = showingTable;
      svgWrap.hidden = !showingTable;
      toggleBtn.textContent = showingTable ? "표로 보기" : "그래프로 보기";
    });

    return card;
  }

  function rightRoundedRectPath(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w, h / 2));
    return `M ${x} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} L ${x} ${y + h} Z`;
  }

  /**
   * Render a horizontal bar chart (category label left, value at bar tip).
   * @param {HTMLElement} container
   * @param {object} opts {categories: [{label, value}], unit, accentColor}
   */
  function renderBarChart(container, opts) {
    const { categories, unit, accentColor } = opts;
    const rowH = 34;
    const barH = 18;
    const pad = { top: 8, right: 54, bottom: 8, left: 90 };
    const w = 560;
    const h = pad.top + pad.bottom + categories.length * rowH;
    const plotW = w - pad.left - pad.right;
    const maxV = Math.max(...categories.map((c) => c.value)) * 1.08 || 1;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "체류자격별 분포 막대 차트");

    categories.forEach((c, i) => {
      const y = pad.top + i * rowH + (rowH - barH) / 2;
      const barW = Math.max(2, (c.value / maxV) * plotW);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", pad.left - 8);
      label.setAttribute("y", y + barH / 2 + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "12");
      label.setAttribute("fill", "var(--text-secondary)");
      label.textContent = c.label;
      svg.appendChild(label);

      const bar = document.createElementNS(svgNS, "path");
      bar.setAttribute("d", rightRoundedRectPath(pad.left, y, barW, barH, 4));
      bar.setAttribute("fill", accentColor);
      svg.appendChild(bar);

      const value = document.createElementNS(svgNS, "text");
      value.setAttribute("x", pad.left + barW + 8);
      value.setAttribute("y", y + barH / 2 + 4);
      value.setAttribute("text-anchor", "start");
      value.setAttribute("font-size", "12");
      value.setAttribute("font-weight", "700");
      value.setAttribute("fill", "var(--text-primary)");
      value.textContent = `${c.value}${unit}`;
      svg.appendChild(value);
    });

    container.appendChild(svg);
  }

  return { renderLineChart, renderChartCard, renderBarChart, buildTable };
})();
