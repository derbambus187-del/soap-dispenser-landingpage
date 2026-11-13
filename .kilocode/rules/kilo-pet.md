# Kilo Pet status

- At the start of each task, call the `pet_start` tool from `kilo-pet`.
- As work progresses, call `pet_update` with the current generic stage: `reading`, `planning`, `working`, or `testing`.
- After completing the requested work and its checks, call `pet_done` as the final tool call before replying.
- If you cannot complete the task because it is blocked, fails, or is canceled, call `pet_interrupted` before replying.
- Never send the user's prompt, code, or other private task content to these tools.