# Wiki.js Docker Setup

## Local Development

### Prerequisites
- Docker Desktop installed and running

### Steps
1. Clone the repo
2. Copy the env file: `copy .env.example .env`
3. Fill in your values in `.env`
4. Run: `docker compose up -d`
5. Open: `http://localhost`

## AWS ECS Deployment

### Prerequisites
- AWS CLI configured
- ECR repository created
- RDS PostgreSQL instance running

### Steps
1. Build the image: `docker build -t wikijs .`
2. Push to ECR: follow AWS ECR push commands
3. Update ECS Task Definition with your RDS env vars:
   - DB_HOST=your-rds-endpoint.amazonaws.com
   - DB_PORT=5432
   - DB_USER=wikijs
   - DB_PASS=yourpassword
   - DB_NAME=wiki
   - DB_SSL=true
4. Deploy the ECS service