import radial from './radial.js'
import relational from './relational.js'
import tree from './tree.js'

/**
 * Every way the graph can be drawn, in the order the switcher offers them.
 *
 * A view is a layout and nothing else: given a scene it says where each node goes, how an edge
 * between two positions is drawn, which way a label runs, and -- if it draws links -- the path of
 * each. Drawing, animating, zooming, hovering and the keyboard are the engine's (`engine.js`), the
 * same for every view. So a new view is a file exporting the shape below and a line here:
 *
 *   key, icon, labelKey     identity, and how the switcher shows it
 *   budget, maxChildren     how much of the tree it can draw at once (`scene.js`)
 *   links                   whether the scene should gather links and their stubs
 *   labelChars, fontSize    how long a label may run, and how big it is drawn
 *   minFitScale             optional -- stop shrinking to fit below this, and start from the top left
 *   layout(scene)           -> { positions, edges, place, label, edgePath, bounds, linkPath?, linkPhase? }
 *
 * Positions are whatever the view interpolates in -- `{ x, y }` for the tree, `{ a, r }` for the
 * radial ones -- and `place` turns one into a point. Moving between two layouts of the SAME view
 * interpolates positions, so nodes travel the view's own way; moving between views interpolates the
 * points, since the two have nothing else in common.
 */
export const GRAPH_VIEWS = [tree, radial, relational]

/**
 * What the graph opens in until somebody picks another view. Named rather than taken from the order
 * above, which is the order the switcher reads in and a separate question.
 */
export const DEFAULT_GRAPH_VIEW = radial

/** The view with this key, or the default for a key that is not one -- absent, or no longer a view. */
export function graphView(key) {
  return GRAPH_VIEWS.find((view) => view.key === key) ?? DEFAULT_GRAPH_VIEW
}
