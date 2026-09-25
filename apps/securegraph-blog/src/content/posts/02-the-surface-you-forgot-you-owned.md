---
title: "The Surface You Forgot You Owned"
no: "02"
order: 2
date: "September 2026"
kicker: "Attack surface"
excerpt: "The riskiest asset in most estates isn't the flagship app. It's the staging host someone launched two years ago and never switched off."
featured: false
---

Ask a team to list what they expose to the internet and you will get a confident answer: the main site, the app, the API, maybe a status page. Map the estate from the outside and the list is usually three times longer.

The extra entries are rarely mysterious. A marketing microsite from a campaign that ended. A staging subdomain with production data "just for testing". A forgotten `robots.txt` that politely lists the directories nobody should visit. Each one was reasonable when it was created, and each one quietly fell out of anyone's inventory.

## Assets come in families

The useful way to see an estate is as a tree, not a list. `example.com` owns its directories and its subdomains; `app.example.com` owns its own paths in turn. When a new host appears under a domain you already own, it should inherit that domain's scope and ownership automatically, instead of waiting in an "unknown" pile for someone to claim it.

Chaining assets this way does two things. It makes gaps obvious: a subdomain with no owner under a parent that has one stands out immediately. And it makes testing honest: if a parent is in scope, you know exactly which children came along with it.

## A short checklist for this week

1. Pull every subdomain your certificates and DNS have ever named, not just the ones in your runbook.
2. Group them under their parent domain and give each group a single owner.
3. Retire anything no owner is willing to claim, or put it in scope and test it.

The attack surface you know about is the one you've already defended. The next incident is more likely to start at the one you forgot.
