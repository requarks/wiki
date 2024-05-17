def app_name = 'mar'
def deployment = 'dev'
/**
* replace remote_user with "maruser"
*/
def username = 'hgurudu'
def target_dir = "/home/$username/$app_name"
def remote_host = '10.44.100.255'
def app = ''

pipeline {
    agent {
        label 'jenkins-slave-0'
    }

    environment {
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = 'production_line_service_account'
        REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
        DOCKER_REGISTRY = 'docker-registry-pt-support-shared.pl.s2-eu.capgemini.com'
        IMAGE = "${DOCKER_REGISTRY}/tpo-bu-germany/${app_name}:${params.VERSION}-${deployment}"
        SSH_CREDENTIALS_ID = 'mar_deployment_keys'
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

        stage('Compile') {
            steps {
                dir('client') {
                    sh 'npm install --force'
                    sh "npm run build:${deployment}"
                }
                dir('dev') {
                    sh 'npm install'
                    sh "npm run build:${deployment}"
                }
            }
        }

       /* stage('Run Tests') {
            steps {
                echo 'Unit Tests: DONE'
            }
        }*/

       /*
         @TODO Need to adjust Dockerfile in dev/build
         docker.build("my-image:${env.BUILD_ID}", "-f ${dockerfile} ./dockerfiles")
       */
        stage('Build images') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'production_line_service_account') {
                        app = docker.build("${IMAGE}", '-f ./dev/build/Dockerfile ./dockerfiles')
                    }
                }
            }
        }

        stage('Push images') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'production_line_service_account') {
                        app.push()
                    }
                }
            }
        }

        stage('Deploy to Kubernetes on remote vm via SSH') {
            steps {
                script {
                    sshagent(${ SSH_CREDENTIALS_ID }) {
                        sh 'rsync -i . $username@$remote_host:/home/$username'
                        sh 'ssh -o StrictHostKeyChecking=accept-new  $username@$remote_host'
                        /**
                         * @TODO To add
                         * helm upgrade install chart and send pass built image as param
                         *    helm upgrade --install
                         *     --set image.repository=${IMAGE}
                        *
                        **/

                        sh """
                            microk8s status
                            microk8s helm version
                            cd mar/dev/helm
                            microk8s helm lint
                            microk8s helm list | grep ${app_name}"
                        """
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
