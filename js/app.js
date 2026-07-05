/* 시장 지표 페이지 (KOSIS) — PROJECT_SPEC.md 섹션 3-1 */
(function () {
  "use strict";

  const { renderStatCard } = window.RenderCards;
  const { renderChartCard } = window.RenderCharts;

  const ACCENT = "var(--accent-market)";

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
          [r.indicator_name, r.area, r.unit, r.period].forEach((c) => {
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

  async function init() {
    const res = await fetch("data/kosis_market.json");
    const data = await res.json();

    document.getElementById("updated-at").textContent =
      `데이터 갱신: ${new Date(data.generated_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;

    const statGrid = document.getElementById("stat-grid");
    data.indicators.forEach((ind) => statGrid.appendChild(renderStatCard(ind, ACCENT)));

    const chartGrid = document.getElementById("chart-grid");
    data.indicators.forEach((ind) => chartGrid.appendChild(renderChartCard(ind, ACCENT, "시장 지표")));

    buildCategoryFilter(data.indicators, chartGrid);
    renderReleases(data.recent_releases);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
