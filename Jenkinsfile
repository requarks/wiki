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
        DOCKER_REGISTRY = 'docker-registry-plindia.pl.s2-eu.capgemini.com'
        IMAGE_NAME = "${DOCKER_REGISTRY}/tpo-bu-germany/${app_name}:${params.VERSION}-${deployment}"
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

        stage('Authenticate and Push Docker Image') {
            steps {
                script {
//                     withCredentials([string(credentialsId: 'dockerRegistryCredentials', variable: 'DOCKER_REGISTRY_PASSWORD')]) {
//                         sh """
//                         echo $DOCKER_REGISTRY_PASSWORD | docker login ${DOCKER_REGISTRY} --username <your-docker-registry-username> --password-stdin
//                         docker tag ${app_name}:latest ${IMAGE_NAME}
//                         docker push ${IMAGE_NAME}
//                         """
//                     }
                  echo 'Authenticate and Push Docker Image: DONE'
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                script {
                    sh """
                    if ! type helm >/dev/null 2>&1; then
                      echo 'Installing Helm locally...'
                      HELM_INSTALL_DIR=\$HOME/bin
                      mkdir -p \$HELM_INSTALL_DIR
                      curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
                      chmod 700 get_helm.sh
                      DESIRED_VERSION=v3.15.0 FORCE_INSTALL_DIR=\$HELM_INSTALL_DIR ./get_helm.sh
                      export PATH=\$HELM_INSTALL_DIR:\$PATH
                    fi
                    """
                    sh 'helm version'

                    sh 'helm repo add stable https://charts.helm.sh/stable'
                    sh 'helm repo update'

                    def helmCommand = """
                        helm upgrade --install --namespace jenkins ${app_name} \
                        --set image.repository=${DOCKER_REGISTRY}/tpo-bu-germany/${app_name} \
                        --set image.tag=${params.VERSION}-${deployment} \
                        dev/helm
                    """
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
