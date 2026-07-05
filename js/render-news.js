/* Generic headline/link list — used for 뉴스 and DART 최근 공시 sections */
window.RenderNews = (function () {
  "use strict";

  /**
   * @param {HTMLElement} container
   * @param {string} title
   * @param {string} sub
   * @param {Array<{title:string, link:string, source?:string, date?:string}>} items
   */
  function renderLinkListCard(container, title, sub, items) {
    const card = document.createElement("div");
    card.className = "card";

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

    if (!items || items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "link-list-empty";
      empty.textContent = "표시할 항목이 없습니다.";
      card.appendChild(empty);
      container.appendChild(card);
      return card;
    }

    const ul = document.createElement("ul");
    ul.className = "link-list";
    items.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = item.title || ""; // textContent — untrusted external text (dataviz skill guidance)
      li.appendChild(a);

      const metaParts = [item.source, item.date].filter(Boolean);
      if (metaParts.length) {
        const meta = document.createElement("p");
        meta.className = "link-meta";
        meta.textContent = metaParts.join(" · ");
        li.appendChild(meta);
      }
      ul.appendChild(li);
    });
    card.appendChild(ul);
    container.appendChild(card);
    return card;
  }

  return { renderLinkListCard };
})();
