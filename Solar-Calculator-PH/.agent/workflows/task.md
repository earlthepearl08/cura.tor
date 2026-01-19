---
description: How to update or add items to the shared TODO.md
---

# 📝 Managing Tasks

When the user wants to add, update, or finish a task:

1.  **View the current list**: Read `/Users/kinmopw/Solar-Calculator-PH/TODO.md` to see the current state.
2.  **Add/Modify**: Use `replace_file_content` or `multi_replace_file_content` to update the task status.
3.  **Cross-reference**: Ensure any files mentioned exist.
4.  **Confirm**: Tell the user the task has been logged or updated.

// turbo
#### Update Script
If many tasks need updating, you can use the `multi_replace_file_content` tool to sync everything at once.
