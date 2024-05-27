pipeline {
    agent {
        label "build_slave_agtool"
    }

    environment {
        PROJECT_NAME = "mar"
        APP_NAME = "capwiki"
        DEPLOYMENT = "dev"
        SSH_CREDENTIAL_ID = "capwiki_DEPLOYMENT_keys"
        DEPLOY_USER = "capwiki"
        TARGET_DIR = "/home/$DEPLOY_USER/$PROJECT_NAME"
        REMOTE_HOST = "10.44.100.255"
        APP_IMAGE = ""
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = "production_line_service_account"
        REPO_URL = "https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git"
        DOCKER_REGISTRY = "docker-registry-pt-support-shared.pl.s2-eu.capgemini.com"
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        IMAGE = "${DOCKER_REGISTRY}/${PROJECT_NAME}/${APP_NAME}:${params.VERSION}-${DEPLOYMENT}"
        APP_URL = "https://capwiki.corp.capgemini.com"
    }

    parameters {
        gitParameter branchFilter: "origin/(.*)", defaultValue: "main", name: "BRANCH", type: "PT_BRANCH"
        string(name: "VERSION", defaultValue: "latest", description: "Specify the version for the images.")
    }

    tools {
        nodejs "nodejs-18.13.0"
    }

    options {
        gitLabConnection("PT-Support-Gitlab")
    }

    stages {
        stage("Git checkout stage") {
            steps {
                git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
            }
        }

       /* stage("Run Tests") {
            steps {
                echo "Unit Tests: DONE"
            }
        }*/

      /* stage("Build images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        APP_IMAGE = docker.build("${IMAGE}")
                    }
                }
            }
      }

        stage("Push images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        APP_IMAGE.push()
                    }
                }
            }
        }

        stage("Deploy to Kubernetes on remote vm via SSH") {
            steps {
                script {
                  // microk8s helm upgrade --install wiki . -f values.yaml --set image.repository=docker-registry-pt-support-shared.pl.s2-eu.capgemini.com/mar/capwiki,image.tag=latest-dev

                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                        sh '''
                          echo 'in ssh agent ${TARGET_DIR}'
                          pwd
                          # to remove existing helm charts diretory
                          ssh ${DEPLOY_USER}@${REMOTE_HOST} "rm -rf ${TARGET_DIR}/helm/*"
                          # to copy helm charts diretory into remote vm
                           rsync -avzi -e "ssh -o StrictHostKeyChecking=accept-new" dev/helm  ${DEPLOY_USER}@${REMOTE_HOST}:${TARGET_DIR}

                          ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                            ls
                            microk8s status
                            microk8s helm version
                            cd ./${TARGET_DIR}/mar/helm
                            pwd
                            microk8s helm list

                            microk8s helm history wiki
                          '
                        '''
                    }
                }
            }
        }
*/
        stage("Wait and check for Pod to be Running") {
            steps {
                script {
                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                        sh '''
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                          podName=$(microk8s kubectl get pods -l app.kubernetes.io/name=capwiki -o jsonpath="{.items[0].metadata.name}")

                          echo "Waiting for pod ${podName} to be running..."
                          status=""
                          count=0

                          while [[ $status != "Running" && $count -lt 5 ]]; do
                            status=$(microk8s kubectl get pod ${podName} -o jsonpath="{status.phase}")
                            sleep 10
                            ((count++))
                          done

                          if[[ $status != "Running" ]]; then
                           echo "Pod ${podName} is not Running"
                           microk8s kubectl logs --tail=20 ${podName} 
                           exit 1
                          fi
                        '
                     '''
                    }
                }
            }
        }

        stage("Verify Application URL") {
            steps {
                script {
                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                        sh '''
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                          curl --silent --show-error --connect-timeout 10 --max-time 20 --write-out 'HTTPSTATUS:%{http_code}' ${APP_URL} 2>&1 | tee curl_output.log
                          connectedTo=$(grep 'Connected to' curl_output.log)
                          httpStatus=$(grep 'HTTPSTATUS:' curl_output.log | sed 's/HTTPSTATUS://')
                          certificateInfo=$(grep 'SSL certificate verify ok' curl_output.log || echo 'Certificate verification failed.')

                          echo "Connection Info: ${connectedTo}"
                          echo "HTTP Status: ${httpStatus}"
                          echo "Certificate Info: ${certificateInfo}"

                          if [ "$httpStatus" -ne 200]; then
                            echo "Application URL check failed. Status code: ${httpStatus}"
                            exit 1
                          fi

                          if [ "$certificateInfo" = 'Certificate verification failed.' ]; then
                            echo "SSL certificate verification failed."
                            exit 1
                          fi
                          echo "Application URL is working. Status code: ${httpStatus}"
                        '
                     '''
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
                echo "Pipeline completed successfully."
            }
            failure {
                echo "Pipeline failed."
            }
    }
}
