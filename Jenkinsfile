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

      /* stage('Build images') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        APP_IMAGE = docker.build("${IMAGE}")
                    }
                }
            }
      }

        stage('Push images') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        APP_IMAGE.push()
                    }
                }
            }
        }
*/

        stage('Verify Kubernetes cluster health') {
            steps {
                script {
                    //  k3s-master-01   True
                    // Active: active (running) since Tue 2024-05-28 00:21:58 CEST; 1h 37min ago
                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                        sh '''
                        echo "verify cluster health"
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                              echo "Check kubelet Status"
                             kubeletStatus=$(systemctl status k3s | grep -i "Active: active (running)")

                              if [ -n "$kubeletStatus" ]; then
                                echo "kubelet service is active and running."
                              else
                                 echo "kubelet service is not active and running. Deployment cannot proceed."
                                 exit 1
                              fi

                              nodeName=$(kubectl get nodes -o jsonpath=\'{.items[*].metadata.name}\')
                              echo "Check nodes readiness ${nodeName}"

                              nodeStatus=$(kubectl get nodes | grep -i ready)
                              echo "node status is  ${nodeStatus}"

                              if [ -n "$nodeStatus" ]; then
                                  echo "Node(s) are ready."
                              else
                                  echo "No nodes are ready. Deployment cannot proceed."
                                  exit 1
                              fi
                            '
                        '''
                    }
                }
            }
        }
  /*
        stage('Deploy to Kubernetes on remote vm via SSH') {
                    steps {
                        script {
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
                                     k3s --version
                                     helm version
                                    cd ./${TARGET_DIR}/mar/helm
                                    pwd
                                     helm list

                                     helm upgrade --install capwiki . -f values.yaml --set image.repository=docker-registry-pt-support-shared.pl.s2-eu.capgemini.com/mar/capwiki,image.tag=latest-dev

                                     helm history capwiki
                                  '
                                '''
                            }
                        }
                    }
        }
*/
        stage('Wait and check for Pod to be Running') {
            steps {
                script {
                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                        sh '''
                        ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                          podName=$(kubectl get pods -l app.kubernetes.io/name=capwiki -o jsonpath="{.items[0].metadata.name}")

                          echo "Waiting for pod ${podName} to be running..."
                          status=""
                          count=1

                           while [ -z "$status" ] && [ "$count" -lt 5 ]; do
                            status=$(kubectl get  pod ${podName} -o jsonpath=\'{.status.containerStatuses[0].state}\' | grep -i running)
                            echo "pod status is ${status}"
                            sleep 10
                            count=$((count + 1))
                          done

                          if echo "$status" | grep -q "running"; then
                              echo "Pod ${podName} is Running"
                          else
                              echo "Pod ${podName} is not Running"
                               kubectl logs --tail=20 ${podName}
                              exit 1
                          fi
                        '
                     '''
                    }
                }
            }
        }

        stage('Verify Application URL') {
            steps {
                script {
                    sshagent(["${SSH_CREDENTIAL_ID}"]) {
                    sh '''
                      ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${REMOTE_HOST} '
                        echo "Check http status"
                        http_status=$(curl -I https://capwiki.corp.capgemini.com 2>&1 | grep -i 'HTTP')
                        echo "Status code: $http_status"

                        # Check if the status code is 200
                        if echo "$http_status" | grep "200"; then
                           echo "Application URL is working. Status code: ${httpStatus}"
                        else
                            echo "HTTP status code is ${http_status}, Application URL is not working"
                        fi

                        echo "Check SSL Server certificate expiry date"

                        curl -v https://capwiki.corp.capgemini.com 2>&1 | grep -E "subject:|start date:|expire date:"

                        # Extract the expiry date from the output of curl
                        expire_date=$(curl -v https://capwiki.corp.capgemini.com 2>&1 | grep -E "expire date:" | cut -d: -f2- | xargs)
                         echo "expiry date: ${expire_date}"

                        # Get today's date
                        today=$(date +%Y-%m-%d)
                          echo "today date: ${today}"

                        # Subtract one month from the expiry date
                        expire_epoch=$(date -d "$expire_date - 1 month" +%Y-%m-%d)
                        echo "expiry epoch: ${expire_epoch}"

                        # Convert the one month before date to seconds since epoch
                        expire_one_month_before_epoch=$(date -d "$expire_epoch" +%s)

                        # Convert today's date to seconds since epoch
                        today_epoch=$(date -d "$today" +%s)

                        # Check if the certificate has expired one month before the expiry date
                        if [ "$today_epoch" -ge "$expire_one_month_before_epoch" ]; then
                            echo "Certificate is going to expire in One month i.e on ${expire_date}, please renew and install it on the server"
                        else
                            echo "HTTPS SSL Certificate is Valid till $ expire_date"
                        fi
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
                echo 'Pipeline completed successfully.'
            }
            failure {
                echo 'Pipeline failed.'
            }
    }
}
