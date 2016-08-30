
if($('#page-type-source').length) {

	var scEditor = ace.edit("source-display");
  scEditor.setTheme("ace/theme/tomorrow_night");
  scEditor.getSession().setMode("ace/mode/markdown");
  scEditor.setReadOnly(true);
  scEditor.renderer.updateFull();

  console.log(scEditor.getSession().getLength());

}