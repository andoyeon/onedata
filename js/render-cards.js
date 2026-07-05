/* Common stat-card component — PROJECT_SPEC.md 섹션 4-2 */
window.RenderCards = (function () {
  "use strict";

  function isIndexUnit(unit) {
    return unit.includes("=");
  }

  function displayUnitBadge(unit) {
    return isIndexUnit(unit) ? `(${unit})` : unit;
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

  function formatPeriod(period) {
    if (period.length === 6) {
      return `${period.slice(0, 4)}년 ${parseInt(period.slice(4, 6), 10)}월`;
    }
    return `${period}년`;
  }

  // delta: positive = up (--color-up), negative = down (--color-down)
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

  function buildSparkline(series, accentColor) {
    const svgNS = "http://www.w3.org/2000/svg";
    const w = 140, h = 34;
    const points = series.slice(-12);
    const values = points.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const xAt = (i) => (points.length === 1 ? 0 : (i / (points.length - 1)) * w);
    const yAt = (v) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("aria-hidden", "true");

    let d = `M ${xAt(0)} ${yAt(values[0])}`;
    points.forEach((pt, i) => { if (i > 0) d += ` L ${xAt(i)} ${yAt(pt.value)}`; });
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--text-secondary)");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", xAt(points.length - 1));
    dot.setAttribute("cy", yAt(values[values.length - 1]));
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", accentColor);
    svg.appendChild(dot);

    return svg;
  }

  /**
   * Build a stat card DOM node.
   * @param {object} indicator {name, unit, series, latest_value, latest_period, delta, delta_pct}
   * @param {string} accentColor CSS color value (e.g. "var(--accent-market)")
   */
  function renderStatCard(indicator, accentColor, sourceLabel) {
    const card = document.createElement("div");
    card.className = "card stat-card";
    card.setAttribute("role", "listitem");

    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = indicator.name;
    card.appendChild(label);

    if (sourceLabel) {
      const badge = document.createElement("span");
      badge.className = "source-badge";
      badge.textContent = sourceLabel;
      card.appendChild(badge);
    }

    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = formatNumber(indicator.latest_value, indicator.unit);
    const unit = document.createElement("span");
    unit.className = "stat-unit";
    unit.textContent = displayUnitBadge(indicator.unit);
    value.appendChild(unit);
    card.appendChild(value);

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
    card.appendChild(meta);

    const spark = document.createElement("div");
    spark.className = "stat-sparkline";
    spark.appendChild(buildSparkline(indicator.series, accentColor));
    card.appendChild(spark);

    return card;
  }

  return {
    formatNumber,
    formatFull,
    formatPeriod,
    formatDelta,
    displayUnitBadge,
    isIndexUnit,
    buildSparkline,
    renderStatCard,
  };
})();
