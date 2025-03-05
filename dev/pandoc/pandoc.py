from flask import Flask, request, send_file
import subprocess

app = Flask(__name__)

@app.route('/convert-to-docx', methods=['POST'])
def convert():
    try:
      input_file = request.files['file']
      input_file.save('/app/input.html')
      output_file = '/app/output.docx'
      subprocess.run(['pandoc', '/app/input.html', '-f', 'html', '-t', 'docx', '-o', output_file])

      return send_file(output_file, as_attachment=True)

    except Exception as e:
       return e, 500

if __name__ == '__main__':
    app.run()
