from flask import Flask, request, send_file
from flask_wtf.csrf import CSRFProtect
import subprocess
from uuid import uuid4

app = Flask(__name__)
csrf = CSRFProtect()
csrf.init_app(app)

@app.route('/convert-to-docx', methods=['POST'])
def convert_to_docx():
    file_suffix = uuid4().hex
    try:
      input_file = request.files['file']
      input_file.save(f'/app/input_{file_suffix}.html')
      output_file = f'/app/output_{file_suffix}.docx'
      reference_file = '/app/reference.docx'
      subprocess.run(['pandoc', f'/app/input_{file_suffix}.html', f'--reference-doc={reference_file}', '-f', 'html', '-t', 'docx', '-o', output_file])

      return send_file(output_file, as_attachment=True)

    except Exception as e:
       return e, 500

    finally:
      subprocess.run(['rm', f'/app/input_{file_suffix}.html'])
      subprocess.run(['rm', f'/app/output_{file_suffix}.docx'])

@app.route('/convert-to-pdf', methods=['POST'])
def convert_to_pdf():
    file_suffix = uuid4().hex
    try:
      input_file = request.files['file']
      input_file.save('/app/input_{file_suffix}.html')
      output_file = '/app/output_{file_suffix}.pdf'
      template_file = '/app/template.tex'
      subprocess.run(['pandoc', f'/app/input_{file_suffix}.html', '--standalone', '--listings', '--pdf-engine=lualatex', f'--template={template_file}', '--toc', '-f', 'html', '-t', 'pdf', '-o', output_file])

      return send_file(output_file, as_attachment=True)

    except Exception as e:
       return e, 500

    finally:
      subprocess.run(['rm', f'/app/input_{file_suffix}.html'])
      subprocess.run(['rm', f'/app/output_{file_suffix}.pdf'])


if __name__ == '__main__':
    app.run()
