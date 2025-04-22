import os
from flask import Flask, request, send_file
#from flask_wtf.csrf import CSRFProtect
import subprocess
from uuid import uuid4

app = Flask(__name__)
#csrf = CSRFProtect()
#csrf.init_app(app)

# Configure paths using environment variables with default fallbacks
LUA_PATH = os.getenv('LUA_PATH', './flexible-columns-table.lua')
TEMPLATE_PATH = os.getenv('TEMPLATE_PATH', './template.tex')
REFERENCE_DOC_PATH = os.getenv('REFERENCE_DOC_PATH', './reference.docx')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', './')

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
      input_path = os.path.join(OUTPUT_DIR, f'input_{file_suffix}.html')
      output_path = os.path.join(OUTPUT_DIR, f'output_{file_suffix}.pdf')

      # Save the input file
      input_file = request.files['file']
      input_file.save(input_path)

        # Run Pandoc command
      subprocess.run(
            ['pandoc', input_path, '--pdf-engine=lualatex',
            f'--template={TEMPLATE_PATH}', f'--lua-filter={LUA_PATH}', '-V', 'colorlinks=true', '-f', 'html', '-t', 'pdf', '-o', output_path],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
      )

      # Return the generated PDF
      return send_file(output_path, as_attachment=True)

    except subprocess.CalledProcessError as e:
        return {'error': f'Pandoc failed: {e.stderr.decode()}'}, 500

    except Exception as e:
        return {'error': str(e)}, 500

    finally:
        subprocess.run(['rm', '-f', input_path])
        subprocess.run(['rm', '-f', output_path])


if __name__ == '__main__':
    app.run()
