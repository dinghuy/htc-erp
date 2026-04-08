---
description: Generate new screens from a text prompt using Stitch MCP.
---

# Workflow: Text-to-Design

Transform a text description into a high-fidelity design screen.

## Steps

### 1. Enhance the User Prompt
Before calling the Stitch MCP tool, apply the [Prompt Enhancement Pipeline](../SKILL.md#prompt-enhancement-pipeline). 
- Identify the platform (Web/Mobile) and page type.
- Incorporate any existing project design system from `.stitch/DESIGN.md`.
- Use specific [Design Mappings](../references/design-mappings.md) and [Prompting Keywords](../references/prompt-keywords.md).

### 2. Identify the Project
Use `list_projects` to find the correct `projectId` if it is not already known.

### 3. Generate the Screen
Call the `generate_screen_from_text` Stitch tool. In Codex, this is exposed as `mcp__stitch__generate_screen_from_text`.

```json
{
  "projectId": "...",
  "prompt": "[Your Enhanced Prompt]",
  "deviceType": "desktop" // or "mobile"
}
```

### 4. Present AI Feedback
Always show the text description and suggestions from `output_components` to the user.

### 5. Download Design Assets
If the user wants local artifacts, call `get_screen` for the generated screen and save the latest HTML and screenshot assets to the `.stitch/designs` directory.
- **Naming**: Use the screen ID or a descriptive slug for the filename.
- **Tools**: In Codex, use `functions.shell_command` with `Invoke-WebRequest` or another available HTTP client.
- **Directory**: Ensure `.stitch/designs` exists.

### 6. Review and Refine
- If the result is not exactly as expected, use the [edit-design](edit-design.md) workflow to make targeted adjustments.
- Do NOT re-generate from scratch unless the fundamental layout is wrong.

## Tips
- **Be structural**: Break the page down into header, hero, features, and footer in your prompt.
- **Specify colors**: Use hex codes for precision.
- **Set the tone**: Explicitly mention if the design should be minimal, professional, or vibrant.
