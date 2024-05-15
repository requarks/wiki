pipeline {
    agent {
        label 'jenkins-slave-0'
    }

    environment {
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = 'production_line_service_account'
        REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
    }

    stages {
        stage('Git checkout stage') {
            steps {
                git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
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
        success {
            echo 'Pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed.'
        }
    }
}
// pipeline {
//     agent {
//         label 'slave-0'
//     }
//
//     environment {
//         BRANCH = "${params.BRANCH}"
//         CREDENTIALS_ID = 'production_line_service_account'
//         REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
//     }
//
//     stages {
//         stage('Git checkout stage') {
//             steps {
//                 git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
//             }
//         }
//         stage('Build Docker Image') {
//             steps {
//                 echo 'Build Docker Image: DONE'
//             }
//         }
//         stage('Code Quality') {
//                     steps {
//                         sh 'npm run lint'
//                     }
//                 }
//         stage('Run Tests') {
//             steps {
//                 echo 'Run Tests: DONE'
//             }
//         }
//         stage('Deploy') {
//             steps {
//                 echo 'Deploy: DONE'
//             }
//         }
//     }
//     post {
//         always {
//             cleanWs()
//         }
//         success {
//             echo 'Pipeline completed successfully.'
//         }
//         failure {
//             echo 'Pipeline failed.'
//         }
//     }
// }
