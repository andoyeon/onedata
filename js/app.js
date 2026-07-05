/* 시장 지표 페이지 (KOSIS) — PROJECT_SPEC.md 섹션 3-1 */
(function () {
  "use strict";

  const { renderStatCard } = window.RenderCards;
  const { renderChartCard } = window.RenderCharts;

  const ACCENT = "var(--accent-market)";

  function buildSubcategoryFilter(container, categories, statGrid, chartGrid) {
    categories.forEach((cat, i) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      chip.textContent = cat;
      chip.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      chip.addEventListener("click", () => {
        container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        [statGrid, chartGrid].forEach((grid) => {
          if (!grid) return;
          grid.querySelectorAll("[data-category]").forEach((card) => {
            card.style.display = cat === "전체" || card.dataset.category === cat ? "" : "none";
          });
        });
      });
      container.appendChild(chip);
    });
  }

  function renderPlaceholderCard(subcategory, reason) {
    const card = document.createElement("div");
    card.className = "card placeholder-card";
    card.dataset.category = subcategory;

    const badge = document.createElement("span");
    badge.className = "placeholder-badge";
    badge.textContent = "준비중";
    card.appendChild(badge);

    const title = document.createElement("p");
    title.className = "placeholder-title";
    title.textContent = subcategory;
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "placeholder-desc";
    desc.textContent = reason;
    card.appendChild(desc);

    return card;
  }

  async function initMarket() {
    const res = await fetch("data/kosis_market.json");
    const data = await res.json();

    document.getElementById("updated-at").textContent =
      `데이터 갱신: ${new Date(data.generated_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;

    const statGrid = document.getElementById("stat-grid");
    data.indicators.forEach((ind) => statGrid.appendChild(renderStatCard(ind, ACCENT)));

    const chartGrid = document.getElementById("chart-grid");
    data.indicators.forEach((ind) => {
      const card = renderChartCard(ind, ACCENT, "시장 지표");
      chartGrid.appendChild(card);
    });

    const categories = ["전체", ...Array.from(new Set(data.indicators.map((i) => i.category)))];
    buildSubcategoryFilter(document.getElementById("category-filter"), categories, null, chartGrid);
  }

  async function initFinancial() {
    const res = await fetch("data/kosis_financial.json");
    const data = await res.json();

    const statGrid = document.getElementById("financial-stat-grid");
    const chartGrid = document.getElementById("financial-chart-grid");

    const bySubcategory = new Map();
    data.indicators.forEach((ind) => {
      if (!bySubcategory.has(ind.category)) bySubcategory.set(ind.category, []);
      bySubcategory.get(ind.category).push(ind);
    });

    data.subcategories.forEach((sub) => {
      const inds = bySubcategory.get(sub);
      if (!inds) {
        statGrid.appendChild(renderPlaceholderCard(sub, "ECOS 미연동으로 해당 지표는 아직 준비 중입니다."));
        return;
      }
      inds.forEach((ind) => {
        const statCard = renderStatCard(ind, ACCENT);
        statCard.dataset.category = ind.category;
        statGrid.appendChild(statCard);
        chartGrid.appendChild(renderChartCard(ind, ACCENT, "금융 지표"));
      });
    });

    const categories = ["전체", ...data.subcategories];
    buildSubcategoryFilter(document.getElementById("financial-filter"), categories, statGrid, chartGrid);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMarket();
    initFinancial();
  });
})();
