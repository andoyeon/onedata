/* 외국인 지표 페이지 — PROJECT_SPEC.md 섹션 3-2 */
(function () {
  "use strict";

  const { renderStatCard, formatNumber, formatPeriod } = window.RenderCards;
  const { renderChartCard, renderBarChart } = window.RenderCharts;
  const { renderLinkListCard } = window.RenderNews;

  const ACCENT = "var(--accent-immigration)";

  async function fetchJsonSafe(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function renderPlaceholderCard(container, title, desc) {
    const card = document.createElement("div");
    card.className = "card placeholder-card";
    const badge = document.createElement("span");
    badge.className = "placeholder-badge";
    badge.textContent = "준비중";
    const t = document.createElement("p");
    t.className = "placeholder-title";
    t.textContent = title;
    const d = document.createElement("p");
    d.className = "placeholder-desc";
    d.textContent = desc;
    card.append(badge, t, d);
    container.appendChild(card);
    return card;
  }

  function renderRateCard(container, name, valuePct, periodText) {
    const card = document.createElement("div");
    card.className = "card stat-card";
    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = name;
    const value = document.createElement("div");
    value.className = "stat-value";
    const dir = valuePct > 0 ? "up" : valuePct < 0 ? "down" : "flat";
    value.textContent = `${valuePct > 0 ? "+" : ""}${valuePct.toFixed(1)}`;
    const unit = document.createElement("span");
    unit.className = "stat-unit";
    unit.textContent = "%";
    value.appendChild(unit);
    value.style.color = dir === "up" ? "var(--color-up)" : dir === "down" ? "var(--color-down)" : "var(--text-primary)";
    const meta = document.createElement("div");
    meta.className = "stat-meta";
    const period = document.createElement("span");
    period.className = "stat-period";
    period.textContent = periodText;
    meta.appendChild(period);
    card.append(label, value, meta);
    container.appendChild(card);
    return card;
  }

  function renderBarChartCard(container, title, sub, categories, unit) {
    const card = document.createElement("div");
    card.className = "card chart-card";
    const head = document.createElement("div");
    head.className = "chart-card-head";
    const titleWrap = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "chart-title";
    h3.textContent = title;
    const subEl = document.createElement("p");
    subEl.className = "chart-sub";
    subEl.textContent = sub;
    titleWrap.append(h3, subEl);
    head.appendChild(titleWrap);
    card.appendChild(head);

    const wrap = document.createElement("div");
    wrap.className = "chart-svg-wrap";
    renderBarChart(wrap, { categories, unit, accentColor: ACCENT });
    card.appendChild(wrap);

    container.appendChild(card);
    return card;
  }

  async function init() {
    const res = await fetch("data/immigration_stats.json");
    const data = await res.json();

    document.getElementById("updated-at").textContent =
      `데이터 갱신: ${new Date(data.generated_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;

    const statGrid = document.getElementById("stat-grid");
    const chartGrid = document.getElementById("chart-grid");
    const cards = data.stat_cards;

    statGrid.appendChild(renderStatCard(cards.total_foreign_residents, ACCENT));

    renderRateCard(
      statGrid,
      cards.yoy_change_rate.name,
      cards.yoy_change_rate.latest_value,
      formatPeriod(cards.yoy_change_rate.latest_period)
    );

    statGrid.appendChild(renderStatCard(cards.annual_entrants, ACCENT));
    statGrid.appendChild(renderStatCard(cards.foreign_marriages, ACCENT));

    if (cards.naturalization) {
      statGrid.appendChild(renderStatCard(cards.naturalization, ACCENT));
    } else {
      renderPlaceholderCard(statGrid, "국적취득 현황", "data.go.kr 연동 후 표시됩니다.");
    }

    if (data.nationality_distribution) {
      renderBarChartCard(chartGrid, "국적별 분포", `${data.nationality_distribution.period}년 · 전국`, data.nationality_distribution.categories, "%");
    } else {
      renderPlaceholderCard(chartGrid, "국적별 분포", "data.go.kr 연동 후 막대 차트로 표시됩니다.");
    }

    const visa = data.visa_status_distribution;
    renderBarChartCard(chartGrid, "체류자격별 분포", `${visa.period}년 · 전국 · 외국인 입국자 비율`, visa.categories, visa.unit);

    const trendIndicator = {
      name: "외국인 등록인구 추이",
      unit: cards.total_foreign_residents.unit,
      area: "전국",
      period_type: "연간",
      category: "trend",
      series: cards.total_foreign_residents.series,
    };
    chartGrid.appendChild(renderChartCard(trendIndicator, ACCENT, "외국인 지표"));

    if (data.net_migration_trend) {
      const netMigration = {
        name: data.net_migration_trend.name,
        unit: data.net_migration_trend.unit,
        area: "전국",
        period_type: "월간",
        category: "trend",
        series: data.net_migration_trend.series,
      };
      chartGrid.appendChild(renderChartCard(netMigration, ACCENT, "외국인 지표"));
    }
  }

  async function initNews() {
    const newsGrid = document.getElementById("news-grid");
    const news = await fetchJsonSafe("data/news_immigration.json");
    renderLinkListCard(
      newsGrid,
      "외국인 관련 뉴스 · 보고서 요약",
      news ? `${news.source} · 갱신 ${new Date(news.generated_at).toLocaleDateString("ko-KR")}` : "Google News RSS",
      news ? news.items.slice(0, 5) : []
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
    initNews();
  });
})();
