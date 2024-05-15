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
                        dir('dev/build') {
                            sh 'docker build -t wiki-js:latest -f Dockerfile .'
                        }
                    }
                }

                stage('Run Tests') {
                    steps {
                        sh 'docker run --rm wiki-js:latest yarn test'
                    }
                }

                stage('Push Docker Image') {
                            steps {
                                withCredentials([string(credentialsId: 'dockerHubCredentials', variable: 'DOCKER_HUB_PASSWORD')]) {
                                    sh """
                                    echo $DOCKER_HUB_PASSWORD | docker login --username <your-dockerhub-username> --password-stdin
                                    docker tag wiki-js:latest <your-dockerhub-username>/wiki-js:${params.VERSION}-${deployment}
                                    docker push <your-dockerhub-username>/wiki-js:${params.VERSION}-${deployment}
                                    """
                                }
                            }
                }


                stage('Deploy') {
                            steps {
                                sshagent(["$ssh_credential_id"]) {
                                    sh """
                                    rsync -i dev/build/config.yml $deploy_user@$host:$target_dir/config.yml
                                    echo >> .env
                                    echo VERSION=${params.VERSION} >> .env
                                    echo TARGET=${deployment} >> .env
                                    rsync -i .env $deploy_user@$host:$target_dir/
                                    ssh -o StrictHostKeyChecking=accept-new $deploy_user@$host "cd $target_dir && \
                                    docker-compose -f $target_dir/config.yml pull -q && \
                                    docker-compose -f $target_dir/config.yml up -d && \
                                    yes | docker image prune --filter dangling=true"
                                    """
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
