pipeline {
    agent {
        label 'slave-0'
    }

    environment {
        BRANCH = "${params.BRANCH}"
        VERSION = "${params.VERSION}"
        CREDENTIALS_ID = 'svc-de-svcderetro/******'
        REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
            }
        }
        stage('Build Docker Image') {
            steps {
                script {
                    try {
                        sh 'docker build -t wiki-js:latest .'
                        echo 'Docker image built successfully'
                    } catch (Exception e) {
                        error "Docker build failed: ${e.message}"
                    }
                }
            }
        }
        stage('Run Tests') {
            steps {
                script {
                    try {
                        sh 'docker run --rm wiki-js:latest yarn test'
                        echo 'Tests completed successfully'
                    } catch (Exception e) {
                        error "Tests failed: ${e.message}"
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    try {
                        sh '''
                        docker-compose -f dev/containers/docker-compose.yml up -d
                        docker exec wiki-app yarn build
                        '''
                        echo 'Deployment successful'
                    } catch (Exception e) {
                        error "Deployment failed: ${e.message}"
                    }
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed.'
        }
    }
}
