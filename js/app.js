/* 시장 지표 페이지 (KOSIS/ECOS/DART/지표누리) — PROJECT_SPEC.md 섹션 3-1 */
(function () {
  "use strict";

  const { renderStatCard } = window.RenderCards;
  const { renderChartCard } = window.RenderCharts;
  const { renderLinkListCard } = window.RenderNews;

  const ACCENT = "var(--accent-market)";

  async function fetchJsonSafe(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

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

  async function initFinancial() {
    const subcategories = ["시장금리", "가계수신", "가계대출", "기업대출", "카드소비", "환율"];
    const statGrid = document.getElementById("financial-stat-grid");
    const chartGrid = document.getElementById("financial-chart-grid");

    // ECOS is the spec's preferred source for 시장금리/가계수신/기업대출; KOSIS
    // (kosis_financial.json) is the fallback until ECOS is fully configured.
    const [kosisData, ecosData] = await Promise.all([
      fetchJsonSafe("data/kosis_financial.json"),
      fetchJsonSafe("data/ecos_market.json"),
    ]);

    if (kosisData) {
      document.getElementById("updated-at").textContent =
        `데이터 갱신: ${new Date(kosisData.generated_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;
    }

    // category -> array of {indicator, source}; a subcategory can have more
    // than one KOSIS indicator (e.g. 시장금리 has both 시장금리 and 중앙은행
    // 정책금리). ECOS, once configured, fully replaces the entries for a
    // subcategory since it's the spec's preferred live source.
    const bySubcategory = new Map();
    (kosisData ? kosisData.indicators : []).forEach((ind) => {
      if (!bySubcategory.has(ind.category)) bySubcategory.set(ind.category, []);
      bySubcategory.get(ind.category).push({ indicator: ind, source: "KOSIS" });
    });
    (ecosData ? ecosData.indicators : []).forEach((ind) => {
      bySubcategory.set(ind.category, [{ indicator: ind, source: "ECOS" }]);
    });

    subcategories.forEach((sub) => {
      const entries = bySubcategory.get(sub);
      if (!entries || entries.length === 0) {
        statGrid.appendChild(renderPlaceholderCard(sub, "아직 연동된 데이터가 없습니다."));
        return;
      }
      entries.forEach(({ indicator, source }) => {
        const statCard = renderStatCard(indicator, ACCENT, source);
        statCard.dataset.category = indicator.category;
        statGrid.appendChild(statCard);
        chartGrid.appendChild(renderChartCard(indicator, ACCENT, "금융 지표", source));
      });
    });

    const categories = ["전체", ...subcategories];
    buildSubcategoryFilter(document.getElementById("financial-filter"), categories, statGrid, chartGrid);
  }

  async function initNews() {
    const newsGrid = document.getElementById("news-grid");
    const [news, dart] = await Promise.all([
      fetchJsonSafe("data/news_market.json"),
      fetchJsonSafe("data/dart_market.json"),
    ]);

    renderLinkListCard(
      newsGrid,
      "금융 뉴스 요약",
      news ? `${news.source} · 갱신 ${new Date(news.generated_at).toLocaleDateString("ko-KR")}` : "Google News RSS",
      news ? news.items.slice(0, 5) : []
    );

    renderLinkListCard(
      newsGrid,
      "최근 공시 (DART)",
      dart ? `${dart.source} · 갱신 ${new Date(dart.generated_at).toLocaleDateString("ko-KR")}` : "DART 전자공시시스템",
      dart ? dart.disclosures.slice(0, 5).map((d) => ({ title: `${d.corp_name} — ${d.report_name}`, link: d.link, source: d.filer, date: d.receipt_date })) : []
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    initFinancial();
    initNews();
  });
})();
