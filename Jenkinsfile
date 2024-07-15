pipeline {
    agent {
        label 'build_slave_agtool'
    }

    environment {
        PROJECT_NAME = 'mar'
        APP_NAME = 'capwiki'
        DEPLOYMENT = 'dev'
        SSH_CREDENTIAL_ID = 'capwiki_deployment_keys'
        DEPLOY_USER = 'capwiki'
        TARGET_DIR = "/home/$DEPLOY_USER/$PROJECT_NAME"
        REMOTE_HOST = '10.44.100.255'
        APP_IMAGE = ''
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = 'production_line_service_account'
        REPO_URL = 'https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git'
        DOCKER_REGISTRY = 'docker-registry-pt-support-shared.pl.s2-eu.capgemini.com'
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}/${APP_NAME}:${params.VERSION}-${DEPLOYMENT}"
        APP_URL = 'https://capwiki.corp.capgemini.com'
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

       /* stage('Run Tests') {
            steps {
                echo "Unit Tests: DONE"
            }
        }*/

    //   stage('Build images') {
    //         steps {
    //             script {
    //                 docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
    //                     APP_IMAGE = docker.build("${IMAGE}", "--no-cache -f Dockerfile .")
    //                 }
    //             }
    //         }
    //   }

    //     stage('Push images') {
    //         steps {
    //             script {
    //                 docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
    //                     APP_IMAGE.push()
    //                 }
    //             }
    //         }
    //     }

        stage('Verify') {
            steps {
                script {
                    dir("deployment") {
                    def output = sh(returnStdout: true, script: 'ls -la')
                    echo "Output: ${output}"

                    sh "./deploy.sh"
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
