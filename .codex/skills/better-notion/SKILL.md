---
name: better-notion
description: Full CRUD for Notion pages, databases, and blocks. Create, read, update, delete, search, and query.
metadata: {"clawdbot":{"emoji":"📝"}}
---

# Notion

Use the Notion API for pages, data sources (databases), and blocks.

## Setup

```bash
mkdir -p ~/.config/notion
echo "ntn_your_key_here" > ~/.config/notion/api_key
```

Share target pages/databases with your integration in Notion UI.

## Common Operations

- **Search**: Find pages or databases by title.
- **Get page**: Retrieve page properties and content.
- **Query database**: Filter and sort database entries.
- **Update page**: Change status, dates, or other properties.
- **Add blocks**: Append content to a page.

## Property Types
Supports Title, Text, Select, Multi-select, Date, Checkbox, Number, and URL.
