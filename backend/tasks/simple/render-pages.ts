/**
 * Render every page waiting in the render queue.
 *
 * Queued whenever a page is added to `pageRenderQueue` — by an explicit re-render, or by an approved
 * suggestion that arrived without its HTML. The work is deliberately not split across jobs: rendering
 * means driving a headless browser, and the whole point of draining the queue in one task is that
 * there is one browser and it renders one page at a time. A run that finds the queue empty (a second
 * job for a batch this one already swept) returns without launching anything.
 */
export async function task(): Promise<void> {
  await WIKI.models.rendering.drainQueue()
}
