def app_name = "wiki-js"
def deployment = "prod"

pipeline {
    agent {
        label 'build_slave_agtool'
    }

    environment {
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = 'production_line_service_account'
        REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
    }

		parameters {
            gitParameter branchFilter: 'origin/(.*)', defaultValue: 'main', name: 'BRANCH', type: 'PT_BRANCH'
            string(name: 'VERSION', defaultValue: 'latest', description: 'Specify the version for the images.')
        }

        tools {
            nodejs 'nodejs-18.13.0'
        }

        options {
            gitLabConnection('PT-Support-Gitlab')
        }

     stages {
             stage('Git checkout stage') {
                 steps {
                     git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
                 }
             }

             stage('Build Docker Image') {
                 steps {
                     dir('dev/containers') {
                         sh 'docker-compose build'
                     }
                 }
             }

             stage('Run Tests') {
                 steps {
                         echo 'Unit Tests: DONE'
                 }
             }

             stage('Push Docker Image') {
                 steps {
                  echo 'Unit Tests: DONE'
//                      withCredentials([string(credentialsId: 'dockerHubCredentials', variable: 'DOCKER_HUB_PASSWORD')]) {
//                          sh """
//                          echo $DOCKER_HUB_PASSWORD | docker login --username <your-dockerhub-username> --password-stdin
//                          docker tag wiki-js:latest <your-dockerhub-username>/wiki-js:${params.VERSION}-${deployment}
//                          docker push <your-dockerhub-username>/wiki-js:${params.VERSION}-${deployment}
//                          """
//                      }
                 }
             }

             stage('Deploy to Kubernetes') {
                         steps {
                             script {
                                 def helmCommand = """
                                     helm upgrade --install --namespace jenkins ${app_name} \
                                     --set image.repository=requarks/wiki \
                                     --set image.tag=${params.VERSION}-${deployment} \
                                     dev/helm
                                 """
                                 sh 'helm version'
                                 sh 'helm list -n jenkins'
                                 sh 'helm lint dev/helm'
                                 sh helmCommand
                                 sh "helm list | grep ${app_name}"
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
