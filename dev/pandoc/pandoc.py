from flask import Flask, request, send_file
import subprocess

app = Flask(__name__)

@app.route('/convert-to-docx', methods=['POST'])
def convert_to_docx():
    input_file = request.files['file']
    input_file.save('/app/input.html')
    output_file = '/app/output.docx'
    reference_file = '/app/reference.docx'
    subprocess.run(['pandoc', '/app/input.html', f'--reference-doc={reference_file}', '-f', 'html', '-t', 'docx', '-o', output_file])

    return send_file(output_file, as_attachment=True)

@app.route('/convert-to-pdf', methods=['POST'])
def convert_to_pdf():
    input_file = request.files['file']
    input_file.save('/app/input.html')
    output_file = '/app/output.pdf'
    template_file = '/app/template.tex'
    subprocess.run(['pandoc', '/app/input.html', '--standalone', '--listings', '--pdf-engine=lualatex', f'--template={template_file}', '--toc', '-f', 'html', '-t', 'pdf', '-o', output_file])

    return send_file(output_file, as_attachment=True)

if __name__ == '__main__':
    app.run()