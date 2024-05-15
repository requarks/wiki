pipeline {
    agent {
        label 'slave-0'
    }

    stages {
        stage('Git checkout stage') {
            steps {
                git branch: 'jenkins-setup', credentialsId: 'production_line_service_account', url: 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
            }
        }
        stage('Build Docker Image') {
            steps {
                sh 'docker build -t wiki-js:latest .'
            }
        }
        stage('Run Tests') {
            steps {
                sh 'docker run --rm wiki-js:latest yarn test'
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                docker-compose -f dev/containers/docker-compose.yml up -d
                docker exec wiki-app yarn build
                '''
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
