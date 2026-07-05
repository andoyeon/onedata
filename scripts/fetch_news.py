#!/usr/bin/env python3
"""Fetch 뉴스 헤드라인 (시장 지표 / 외국인 지표) from Google News RSS.

No API key needed — Google News RSS is a public, unauthenticated search
feed, so this script has no secret to protect. We still avoid printing
the exact request URL in logs, for consistency with the other fetch
scripts and PROJECT_SPEC.md 섹션 0-1's spirit (minimize what appears in
CI logs generally).

Usage:
    python scripts/fetch_news.py market        # -> data/news_market.json
    python scripts/fetch_news.py immigration   # -> data/news_immigration.json

This only does headline parsing (title/link/source/date) — no full-text
summarization, since that would need fetching and condensing each
article's full page, which is unreliable to do unattended in CI.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

BASE_URL = "https://news.google.com/rss/search"

QUERIES = {
    "market": {
        "q": "금리 OR 환율 OR 증시 OR 코스피 금융",
        "label": "금융 뉴스",
        "out_file": "news_market.json",
    },
    "immigration": {
        "q": "외국인 투자 환율 OR 외국인 순매수 OR 체류외국인 OR 외국인 정책",
        "label": "외국인 관련 뉴스·보고서",
        "out_file": "news_immigration.json",
    },
}


def fetch_rss(query, max_items=12):
    params = {"q": query, "hl": "ko", "gl": "KR", "ceid": "KR:ko"}
    url = BASE_URL + "?" + urllib.parse.urlencode(params)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (onedata-bot)"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
    except urllib.error.URLError:
        print("Google News RSS request failed (network error).")
        return None

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        print("Google News RSS response was not valid XML.")
        return None

    items = []
    for item in root.findall(".//item")[:max_items]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        source = source_el.text.strip() if source_el is not None and source_el.text else None

        # Google News titles are usually "Headline - Source Name" even when
        # <source> is also present, so strip the suffix either way.
        m = re.match(r"^(.*)\s-\s([^-]+)$", title)
        if m:
            title = m.group(1).strip()
            source = source or m.group(2).strip()

        date_str = None
        if pub_date:
            try:
                date_str = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d")
            except ValueError:
                date_str = pub_date

        if title and link:
            items.append({"title": title, "link": link, "source": source, "date": date_str})

    return items


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in QUERIES:
        print(f"Usage: python {sys.argv[0]} <{'|'.join(QUERIES)}>")
        sys.exit(1)

    cfg = QUERIES[sys.argv[1]]
    items = fetch_rss(cfg["q"])

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out_path = os.path.join(data_dir, cfg["out_file"])

    if items is None:
        print(f"No news fetched; leaving {out_path} untouched.")
        return

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "source": "Google News RSS",
        "label": cfg["label"],
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(items)} news items -> {out_path}")


if __name__ == "__main__":
    main()
