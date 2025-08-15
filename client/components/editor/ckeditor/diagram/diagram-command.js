import Command from '@ckeditor/ckeditor5-core/src/command.js'

export default class DiagramCommand extends Command {
  refresh() {
    const { document } = this.editor.model;

    this.isEnabled = document.selection.getSelectedElement()?._attrs?.get( 'src' )?.startsWith( 'data:image/svg+xml;base64' );
  }
}
