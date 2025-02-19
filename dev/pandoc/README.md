# Pandoc 
Here below explained how to set up a multi-threaded HTTP server using Gunicorn. It is containerized using Docker for easy deployment and management.


## Requirements

- Docker
- Docker Compose

## Setup Instructions

1. To run docker compose from dev/containers folder:

   ```
   cd dev/pandoc
   docker build -t pandoc:latest .

   cd dev/containers
   docker-compose up -d
   ```

2.  Pandoc instance:

The pandoc instance will be accessible at `http://localhost:80`

## Usage

Once the application is running, we can test it by using below command: 
  1. To convert html input file to docx, run below command:
   
  ```
  sudo curl -F 'file=@input.html' http://localhost:80/convert-to-docx -o output.docx

  ```
